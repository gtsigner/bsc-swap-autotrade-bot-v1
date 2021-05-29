import ERC20_ABI from "./abis/ERC20.json";
import {config, TRADE_TOKENS} from "./config";
import * as lodash from "lodash";
import {Currency, Pair, Token} from "@godtoy/pancakeswap-sdk-v2";
import {wrappedCurrency} from "./utils/wrappedCurrency";
import {PairState, usePairs} from "./data/reverses";
import {callMethod} from "./contracts";

const Web3 = require('web3');
const web3 = new Web3('https://bsc-dataseed1.binance.org:443');

//ERC20_ABI
//https://blog.csdn.net/weixin_40345905/article/details/81290891
export async function getContractToken(address: string, decimals?: number, symbol?: string, name?: string): Promise<any> {
    const ts = Date.now();
    const tokenAddress = address //ADA ada token address
    const contract = new web3.eth.Contract(ERC20_ABI, tokenAddress)
    if (!decimals) {
        // @ts-ignore
        decimals = await callMethod(contract, "decimals", {})
    }
    if (!symbol) {
        // @ts-ignore
        symbol = await callMethod(contract, "symbol", {})
    }
    const token = new Token(config.chainId, tokenAddress, decimals, symbol, name) //bnb
    return {tokenOutput: token, contract, time: Date.now() - ts}
}

const basePairs: [Token, Token][] = lodash.flatMap(TRADE_TOKENS, (base): [Token, Token][] => TRADE_TOKENS.map((otherBase) => [base, otherBase])).filter(
    ([t0, t1]) => t0.address !== t1.address
)

//组装
export async function useAllCommonPairs(currencyA?: Currency, currencyB?: Currency): Promise<Pair[]> {
    const pairs: any = [...basePairs]
    const chainId = config.chainId;
    const [tokenA, tokenB] = chainId ? [wrappedCurrency(currencyA, chainId), wrappedCurrency(currencyB, chainId)] : [undefined, undefined];
    if (tokenA && tokenB) {
        pairs.push([tokenA, tokenB])
        pairs.push(
            ...TRADE_TOKENS.map((base): [Token, Token] => [tokenB, base]),
            ...TRADE_TOKENS.map((base): [Token, Token] => [tokenA, base]),
        )
    }
    const allPairs = await usePairs(pairs)

    const results = allPairs
        // filter out invalid pairs
        .filter((result): result is [PairState.EXISTS, Pair] => Boolean(result[0] === PairState.EXISTS && result[1]))
        // filter out duplicated pairs
        .reduce((memo, [, curr]) => {
            memo[curr.liquidityToken.address] = memo[curr.liquidityToken.address] ?? curr
            return memo
        }, {});
    return Object.values(results)
}