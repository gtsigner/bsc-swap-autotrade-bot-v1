import {config, provider} from "./config";
import {Signer} from '@ethersproject/abstract-signer'
import {ethers} from 'ethers'

import Web3 from 'web3';

export const web3 = new Web3(config.provider);
export const activateAccount: any = web3.eth.accounts.privateKeyToAccount(config.walletPvKey);

export const wallet = new ethers.Wallet(config.walletPvKey, provider)
