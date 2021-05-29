//import account bnb
import {ethers} from "ethers";
import {config, provider} from "./config";

async function run() {
    const wallet = new ethers.Wallet(config.walletPvKey, provider)
    const addr = await wallet.getAddress()
    const bal = await wallet.getBalance()
}

run()