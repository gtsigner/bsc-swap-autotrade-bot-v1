import {ChainId, Currency, CurrencyAmount, ETHER, Token, TokenAmount, WETH} from "@godtoy/pancakeswap-sdk-v2";
import {parseUnits} from "@ethersproject/units";
import JSBI from "jsbi";

export function wrappedCurrency(currency: Currency | undefined, chainId: ChainId | undefined): Token | undefined {
    // eslint-disable-next-line no-nested-ternary
    return chainId && currency === ETHER ? WETH[chainId] : currency instanceof Token ? currency : undefined
}

export function wrappedCurrencyAmount(currencyAmount: CurrencyAmount | undefined, chainId: ChainId | undefined): TokenAmount | undefined {
    const token = currencyAmount && chainId ? wrappedCurrency(currencyAmount.currency, chainId) : undefined
    return token && currencyAmount ? new TokenAmount(token, currencyAmount.raw) : undefined
}

export function unwrappedToken(token: Token): Currency {
    if (token.equals(WETH[token.chainId])) return ETHER
    return token
}

export function tryParseAmount(value?: string, currency?: Currency): CurrencyAmount | undefined {
    if (!value || !currency) {
        return undefined
    }
    try {
        const typedValueParsed = parseUnits(value, currency.decimals).toString()
        if (typedValueParsed !== '0') {
            return currency instanceof Token ? new TokenAmount(currency, JSBI.BigInt(typedValueParsed)) : CurrencyAmount.ether(JSBI.BigInt(typedValueParsed))
        }
    } catch (error) {
        // should fail if the user specifies too many decimal places of precision (or maybe exceed max uint?)
        console.info(`Failed to parse input amount: "${value}"`, error)
    }
    // necessary for all paths to return a value
    return undefined
}
