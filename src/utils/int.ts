export default function isZero(hexNumberString: string) {
    return /^0x0*$/.test(hexNumberString)
}