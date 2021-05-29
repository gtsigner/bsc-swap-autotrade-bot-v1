import {Currency, Pair, ChainId, Token, Percent, JSBI, WETH} from "@godtoy/pancakeswap-sdk-v2";
import * as ethers from "ethers";
import env from 'dotenv'

const envConfig = env.config();

export const config: any = {
    id: 1,
    name: 'BSC Mainnet',
    // provider: 'https://bsc-dataseed1.binance.org',
    provider: 'https://bsc-dataseed1.defibit.io',
    scan: 'https://api.bscscan.com/api',
    ws: "wss://bsc-ws-node.nariox.org:443",
    explore: 'https://bscscan.com/',
    type: 'mainnet',
    chainId: 56,
    apiKey: '',
    icon: 'images/bscpay.png',
    walletPvKey: "",
    ...envConfig.parsed,
};
config.walletPvKey = config.WALLET_PRIVATE_KEY;
export const ROUTES = {
    pancakeswap: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
    BakerySwap: "0xcde540d7eafe93ac5fe6233bee57e1270d3e330f",
}
config.ROUTE_ADDRESS = ROUTES[config.ROUTE_SWAP_CHOOSE]

if (!config.ROUTE_ADDRESS) {
    throw new Error("require route swap address")
}

export const provider = new ethers.providers.JsonRpcProvider(config.provider) //https://dataseed1.binance.org
export const websocketProvider = new ethers.providers.WebSocketProvider(config.ws) //https://dataseed1.binance.org

//multicall contract address
//合约 https://bscscan.com/address/0x1Ee38d535d541c55C9dae27B12edf090C608E6Fb#code
const MULTICALL_NETWORKS: { [chainId in ChainId]: string } = {
    [ChainId.MAINNET]: '0x1Ee38d535d541c55C9dae27B12edf090C608E6Fb', // TODO
    [ChainId.BSCTESTNET]: '0x301907b5835a2d723Fe3e9E8C5Bc5375d5c1236A'
}


//BSC chain
export const WBNB = WETH[config.chainId];
export const CAKE = new Token(ChainId.MAINNET, '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', 18, 'CAKE', 'PancakeSwap Token')
export const DAI = new Token(ChainId.MAINNET, '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', 18, 'DAI', 'Dai Stablecoin')
export const BUSD = new Token(ChainId.MAINNET, '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', 18, 'BUSD', 'Binance USD')
export const BTCB = new Token(ChainId.MAINNET, '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', 18, 'BTCB', 'Binance BTC')
export const USDT = new Token(ChainId.MAINNET, '0x55d398326f99059fF775485246999027B3197955', 18, 'USDT', 'Tether USD')
export const UST = new Token(ChainId.MAINNET, '0x23396cF899Ca06c4472205fC903bDB4de249D6fC', 18, 'UST', 'Wrapped UST Token')
export const ETH = new Token(ChainId.MAINNET, '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', 18, 'ETH', 'Binance-Peg Ethereum Token')

export const TRADE_TOKENS = [WBNB, DAI, BUSD, BTCB, USDT, UST, ETH];
