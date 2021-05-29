import {MULTICALL_ABI, MULTICALL_NETWORKS} from "./multicall";
import {web3} from "../wallet";
import {config} from "../config";

//https://docs.binance.org/smart-chain/developer/rpc.html

export function useMulticallContract(): any {
    const chainId = config.chainId
    const address = chainId && MULTICALL_NETWORKS[chainId]
    // @ts-ignore
    return new web3.eth.Contract(MULTICALL_ABI, address)
}

