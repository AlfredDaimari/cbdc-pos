// file for generating user keys

const crypto = require('crypto');
const fs = require('fs');

const createKeys = () => {
    var keys = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            format: 'pem',
            type: 'pkcs8'
        }
    })

    return keys
}


const saveKeys = (userNames) => {
    for (let n of userNames) {
        var { privateKey, publicKey } = createKeys()
        fs.open(`${__dirname}/wallet/publicKey${n}.pem`, "w", (err, fd) => {
            fs.writeFile(fd, publicKey, () => console.log(`saved pub key to ${n}`))
        })

        fs.open(`${__dirname}/wallet/privateKey${n}.pem`, "w", (err, fd) => {
            fs.writeFile(fd, privateKey, () => console.log(`saved priv key to ${n}`))
        })

    }
}

saveKeys(["us3"])
setTimeout(() => {
    saveKeys(["us4"])
}, 2000)
setTimeout(() => {
    saveKeys(["us5"])
}, 2000)