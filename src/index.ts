import {ETHER, Percent, Router, Token, Trade} from "@godtoy/pancakeswap-sdk-v2";
import {MaxUint256} from '@ethersproject/constants'
import {abi as IUniswapV2Router02ABI} from '@uniswap/v2-periphery/build/IUniswapV2Router02.json'
import ERC20 from './abis/ERC20.json'
import {activateAccount, wallet, web3} from './wallet'
import {getContractToken, useAllCommonPairs} from "./helper";
import {config, provider, WBNB, websocketProvider} from "./config";
import {parseUnits} from '@ethersproject/units'
import {logger} from "./utils/logger";
import {Contract, ethers} from "ethers";
import isZero from "./utils/int";
import {tryParseAmount} from "./utils/wrappedCurrency";
import {sleep} from "./utils/utils";
import EventEmitter from "events";

const schedule = require('node-schedule');
const JSBI = require('jsbi')

const BIPS_BASE = JSBI.BigInt(10000)
// const ROUTER_ADDRESS = '0x05fF2B0DB69458A0750badebc4f9e13aDd608C7F';//PancakeSwap: Router v1
// const ROUTER_ADDRESS = '0x10ED43C718714eb63d5aA57B78B54704E256024E';//PancakeSwap: Router v2
const ROUTER_ADDRESS = config.ROUTE_ADDRESS

// @ts-ignore
const routerContract = new web3.eth.Contract(IUniswapV2Router02ABI, ROUTER_ADDRESS); //路由合约

const outputAddress = config.SWAP_OUTPUT_TOKEN;

const ERROR = 'Insufficient liquidity for this trade.';

// https://www.cnblogs.com/jameszou/p/10131443.html ERC20合约
//监控区块变动
(() => {
    const contract = new ethers.Contract(outputAddress, ERC20, websocketProvider).connect(wallet)
    contract.on('Transfer', function (from, to, amount) {
        // logger.warn("Transfer.event: ", from, to, amount.toString())
        // console.log('started event1');
        // console.log("purchaser:" + purchaser);
        // console.log("value:" + value);
        // console.log("amount:" + amount, typeof amount);
    })
})();

enum TaskStep {
    Selling,
    Buying
}

enum SellType {
    None = 0,
    TakeProfit = 1,
    StopLoss = 2,
}

const task = {
    tradeAmount: "0.002",//交换3个
    swapOptions: {
        feeOnTransfer: false,
        allowedSlippage: new Percent(JSBI.BigInt(Math.floor(1200)), BIPS_BASE), //12%
        recipient: activateAccount.address, //account address
        ttl: 60 * 2, //2min
    },
    tradeOptions: {
        maxHops: 3,
        maxNumResults: 1
    },
    _loaded: false, //是否加载完毕
    _buyedPrice: 0,//买入的价格
    MAX_TAKE_PROFIT_POINT: 1, //翻倍pec
    MIN_STOP_LOSS_POINT: 0.5,//最低跌价卖出
    wallet: {
        outputAmount: "0",
    },
    step: TaskStep.Buying, //状态
    swap: {
        currentPrice: "",
    }
}

class Monitor extends EventEmitter {
    private swapper: any

    constructor(swapper) {
        super();
        this.swapper = swapper
    }

    private running: boolean = false;

    private liquidity = false;

    start() {
        this.running = true
        this.run().then()
        this.monitWallet().then()
    }

    private async fetchTrade() {
        try {
            const amount = task.tradeAmount
            const trade = await this.swapper.GetBuyTrade(amount)
            const oldQ = this.liquidity;
            const newQ = !!trade;
            if (oldQ !== newQ) {
                this.emit('liquidity.on', trade) //有交易流动性
            }
            this.liquidity = newQ
            if (!trade) {
                return
            }
            this.emit('liquidity.timer', amount, trade) //有交易流动性
        } catch (e) {
            console.error(e.message)
        }
    }

    private async run() {
        while (this.running) {
            await sleep(500)
            await this.fetchTrade()
        }
        // //这个时间不能太短了，不然会被ban
        // schedule.scheduleJob('*/1 * * * * *', async () => {
        //     await this.fetchTrade()
        // });
    }

    private async monitWallet() {
        while (this.running) {
            await sleep(500)
            let {output, outputAmount} = await this.swapper.getBalances();//查询出来的账户月
            const am = {outputAmount: outputAmount, amount: outputAmount.toString()}
            this.emit('wallet.update.output_token', am);
            if (!task._loaded) {
                task._loaded = true
                this.emit('wallet.loaded', am)
            }
        }
    }

    private async monitorSwap() {
        //1w * 300
    }
}

const scheduleMonitor = async () => {
    const swapper = new Swapper(outputAddress);
    await swapper.init() //初始化合约信息
    const monitor = new Monitor(swapper)
    monitor.start()

    //具有流动性了
    monitor.on('liquidity.on', (trade) => {
        logger.warn("liquidity changed")
    })

    monitor.on('liquidity.timer', async (amount, trade) => {
        const info = swapper.printTrade("liquidity.timer", amount, trade)
        //设置当前价格
        task.swap.currentPrice = info.executionPrice;
        logger.trace(`swap.price.update: ${task.wallet.outputAmount} / percent:${swapper.getPrc(task.swap.currentPrice).toFixed(5)} / [C=${task.swap.currentPrice},B=${task._buyedPrice}]`) //当前价格
        if (task._buyedPrice <= 0) return;
        await swapper.autoSell(task.wallet.outputAmount, info) //自动卖出
    })

    //当达到一定倍数后自动卖出
    monitor.on('wallet.update.output_token', async (wallet) => {
        if (task.wallet.outputAmount !== wallet.amount && task._buyedPrice) {
            logger.trace(`wallet.update.output_token: ${wallet.amount} / ${swapper.getPrc(task.swap.currentPrice).toFixed(5)}`) //当前价格
        }
        task.wallet.outputAmount = wallet.amount;
    })

    let running = false;
    //任务加载完毕
    monitor.on('wallet.loaded', (wallet) => {
        running = true;
        logger.warn("wallet loaded:", wallet)
    })

    //每分钟的第30秒定时执行一次: //future will set a loop under bsc requests limit instead of a timer schedule
    schedule.scheduleJob('*/1 * * * * *', async () => {
        if (!running) return;
        try {
            const amount = task.tradeAmount;
            const trade = await swapper.GetBuyTrade(amount);
            if (!trade) {
                logger.trace("GetBuyTrade:", ERROR);
                return
            }
            await swapper.doBuyTrade(amount, trade);
        } catch (e) {
            console.error(e.message)
        }
    });
}

export class Swapper {
    private outputToken: any;
    private readonly outputTokenAddress: string;
    private outputTokenContract
    private inputTokenContract;

    private inputToken: Token = WBNB;
    private tradeOptions = {
        maxHops: 3,
        maxNumResults: 1,
        ...task.tradeOptions
    };
    private swapOptions = {
        feeOnTransfer: false,
        allowedSlippage: new Percent(JSBI.BigInt(Math.floor(1200)), BIPS_BASE), //滑动万分之..
        recipient: activateAccount.address, //account address
        ttl: 60 * 2, //2min,
        ...task.swapOptions
    }

    private accountContract: Contract;
    private accountSwapContract: Contract;

    private isTrading = false;
    private cached: any = {route: "", price: "",};

    constructor(outAddress: string) {
        this.outputTokenAddress = outAddress
        this.accountContract = new ethers.Contract(this.inputToken.address, ERC20, provider)
        this.accountContract = this.accountContract.connect(wallet)
        this.accountSwapContract = new ethers.Contract(ROUTER_ADDRESS, IUniswapV2Router02ABI, provider).connect(wallet)
    }

    async init() {
        //init contract
        const {tokenOutput} = await getContractToken(this.outputTokenAddress)
        this.outputToken = tokenOutput
        logger.info(`OutputToken loaded:${this.outputTokenAddress} / ${this.outputToken.symbol} / ${this.outputToken.decimals}`)

        //1.授权output Token交易
        await this.approve(this.inputToken.address, MaxUint256)
        await this.approve(this.outputToken.address, MaxUint256)
        // await this.approve(BUSD.address, MaxUint256) //授权

        // this.inputTokenContract = new ethers.Contract(WBNB, ERC20, provider)
        this.outputTokenContract = new ethers.Contract(this.outputToken.address, ERC20, provider)
    }

    private async approve(spender: string, amount: any) {
        const add = await this.accountContract.allowance(wallet.address, spender)
        const apped = ethers.BigNumber.from(add)
        if (!apped.gt(0)) {
            const res = await this.accountContract.approve(spender, amount) //授权
            logger.warn(`approved: ${spender}`, apped.toString())
        }
    }

    //获取交易pairs列表
    async getPairs(): Promise<any> {
        return useAllCommonPairs(this.inputToken, this.outputToken)
    }

    //获取账户的现金余额
    async getBalances(): Promise<any> {
        const walletAddress = await wallet.getAddress()
        const outputBalance = await this.outputTokenContract.balanceOf(walletAddress) ///输出token的金额
        const valB = ethers.utils.formatUnits(outputBalance, this.outputToken.decimals).toString() //余额1
        return {output: outputBalance, outputAmount: valB}
    }

    async GetBuyTrade(amount) {
        const pairsList = await useAllCommonPairs(this.inputToken, this.outputToken)
        const curr = tryParseAmount(amount, ETHER) //parse amount 使用默认 ETHER 才会调用 swapExactETHForTokens
        return Trade.bestTradeExactIn(pairsList, curr, this.outputToken, this.tradeOptions)[0] ?? null
    }

    async GetSellTrade(amount) {
        const pairsList = await this.getPairs()
        const ip = this.outputToken
        // const op = this.inputToken //将什么给换出来
        const op = ETHER //BNB换出来
        const curr = tryParseAmount(amount, ip) //换出来
        return Trade.bestTradeExactIn(pairsList, curr, op, this.tradeOptions)[0] ?? null
    }

    tradeInfo(trade) {
        const executionPrice = trade.executionPrice.invert().toSignificant(6);
        const nextMidPrice = trade.nextMidPrice.invert().toSignificant(6);
        const outputAmount = trade.outputAmount.toSignificant(6);
        const inputAmount = trade.inputAmount.toSignificant(6);
        const priceImpact = trade.priceImpact.toSignificant(6);
        return {executionPrice, nextMidPrice, outputAmount, inputAmount, priceImpact}
    }

    private async gas(parameters, options): Promise<any> {
        return await this.accountSwapContract.estimateGas[parameters.methodName](...parameters.args, options);
    }

    async execSwap(amount: string, trade) {
        try {
            const info = this.tradeInfo(trade) //交易信息
            const startTime = Date.now()
            const parameters = Router.swapCallParameters(trade, this.swapOptions)
            const encoded_tx = routerContract.methods[parameters.methodName](...parameters.args).encodeABI();
            amount = ethers.utils.formatEther(parameters.value)
            const value = parseUnits(amount, trade.inputAmount.decimals)
            let transactionObject: any = {
                gasLimit: 2062883, //gas费用
                // value: value,//转账金额
                data: encoded_tx,
                from: activateAccount.address,
                to: ROUTER_ADDRESS,
                value: value,
            };
            task._buyedPrice = info.executionPrice;
            let routeTag = `Swap:[${trade.inputAmount.currency.symbol}->${trade.outputAmount.currency.symbol}][price=${task._buyedPrice}]`
            let gas: any = "";
            try {
                const value = parameters.value;
                const options = !value || isZero(value) ? {} : {value}
                gas = await this.gas(parameters, options)
            } catch (e) {
                logger.error("gas.error:", e.reason)
            }
            if (gas) {
                // transactionObject.gasLimit = gas.toNumber() * 3 //使用3倍gas费
            }
            const wasteGas = Date.now() - startTime
            logger.trace(`Start.swap: ${routeTag} | ${parameters.methodName}, gasLimit:${gas.toString()} / Time:${wasteGas}ms,value: ${ethers.utils.formatUnits(value, trade.inputAmount.decimals).toString()}`)
            const res = await wallet.sendTransaction(transactionObject);
            const receipt = await res.wait();//等待区块确认
            const transTime = Date.now() - startTime
            if (receipt.status) {
                logger.info(`Transaction.success: ${routeTag} gasUsed:${receipt.gasUsed.toString()},time:${transTime}ms,confirmations:${receipt.confirmations}`);
                task.step = TaskStep.Selling;//已经买入成功
            } else {
                logger.error("Swap.error:", receipt)
            }
        } catch (e) {
            logger.error("execSwapSell:", e.reason)
        }
        return
    }

    printTrade(tag: string, amount, trade) {
        const info = this.tradeInfo(trade)
        const old = {...this.cached}
        this.cached.route = SwapRoutePrint(trade).join('->')
        this.cached.price = info.executionPrice
        if (this.cached.route != old.route || this.cached.price != old.price) {
            logger.warn(`[${tag}]Route.stateChange: ${SwapRoutePrint(trade).join('->')} / Price:${info.executionPrice},Input:${info.inputAmount},Output:${info.outputAmount}`)
        }
        return info
    }

    //do Sell
    async doBuyTrade(amount, trade) {
        const info = this.tradeInfo(trade)
        amount = info.inputAmount;
        if (!this.isTrading && this.canBuyMore()) {
            this.isTrading = true
            await this.execSwap(amount, trade).finally(() => {
                this.isTrading = false
            })
        }
    }

    //是否能买
    private canBuyMore(): boolean {
        if (!task._loaded) return false;//加载完毕
        if (this.isSelling) return false;//正在卖出
        return task.step === TaskStep.Buying;
    }

    //自动卖出
    private isSelling = false;//是否正在卖出

    public getPrc(currentPrice) {
        return (currentPrice / task._buyedPrice)
    }

    private async _doSell(amount, currentPrice) {
        try {
            const prc = (currentPrice / task._buyedPrice)
            let needSellType = SellType.None;
            if (prc >= task.MAX_TAKE_PROFIT_POINT) {
                needSellType = SellType.TakeProfit
            }
            if (prc <= task.MIN_STOP_LOSS_POINT) {
                needSellType = SellType.StopLoss
            }
            if (needSellType === SellType.None) return; //Unknown
            logger.trace(`AutoSell->[${prc},${needSellType}]->BuyPrice:${task._buyedPrice}->CurrentPrice:${currentPrice},amount:${task.wallet.outputAmount}`)
            const trade = await this.GetSellTrade(amount);
            if (!trade) {
                logger.trace("SellTrade:", ERROR);
                return
            }
            const info = this.tradeInfo(trade)
            amount = info.inputAmount;
            await this.execSwap(amount, trade);
        } catch (e) {
            console.error(e.message)
        }
    }

    public async autoSell(amount, info) {
        if (this.isSelling) return; //返回
        this.isSelling = true;
        await this._doSell(amount, info.executionPrice).finally(() => {
            this.isSelling = false;
        })
    }
}

scheduleMonitor();

function SwapRoutePrint(trade: Trade) {
    return trade.route.path.map((token, i, path) => {
        return token.symbol
    })
}
