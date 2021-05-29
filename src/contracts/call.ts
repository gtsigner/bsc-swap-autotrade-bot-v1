export async function callMethod(contract, methodName, inputs) {
    return new Promise((resolve, reject) => {
        contract.methods[methodName]().call(inputs, (err, result) => {
            if (err) {
                return reject(err)
            }
            return resolve(result)
        });
    })
}

export async function callContractMethod(contract, methodName, inputs?: any, options?: any): Promise<any> {
    return new Promise((resolve, reject) => {
        contract.methods[methodName](inputs).call(options, (err, result) => {
            if (err) {
                return reject(err)
            }
            return resolve(result)
        });
    })
}