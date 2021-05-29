import {ethers} from "ethers";
import ERC20 from "../abis/ERC20.json";
import {websocketProvider} from "../config";
import {wallet} from "../wallet";
import {logger} from "../utils/logger";

const outputAddress = "0xac51066d7bec65dc4589368da368b212745d63e8" //"ALICE"

const ERROR = 'Insufficient liquidity for this trade.';

// https://www.cnblogs.com/jameszou/p/10131443.html ERC20合约
//监控区块变动
(() => {
    const contract = new ethers.Contract(outputAddress, ERC20, websocketProvider).connect(wallet)
    contract.on('Transfer', function (from, to, amount) {
        logger.warn("Transfer.event: ", from, to, amount.toString())
    })
})();