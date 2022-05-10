const fs = require('fs');
const mongoose = require('mongoose');
const crypto = require('crypto')


const TxnSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    },
    origin: {
        type: String,
        required: true
    },
    pubKey: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    spent: {
        type: Boolean,
        required: true
    }
},
    {
        timestamps: true,
    })

const Txn = mongoose.model(`txnsCBDC`, TxnSchema, `txnsCBDC`)


const connectToDB = async () => {
    await mongoose.connect('mongodb+srv://pos_node:pos_node@g0-cluster.4szx0.mongodb.net/pos_bk_db?retryWrites=true&w=majority')
}

// ! currently only flags the first double spending - txn chain not implemented
const addTxnsToDB = async (txns) => {
    for (let txn of txns) {
        if (txn.spent) {
            let check = await Txn.find({ id: txn.id })

            if (check.length == 0) {
                var ntxn = new Txn()
                ntxn.id = txn.id
                ntxn.pubKey = txn.pubKey
                ntxn.amount = txn.amount
                ntxn.origin = txn.origin
                ntxn.spent = true
                console.log(`new transaction added to db ${JSON.stringify(txn)} -- ${Date()}`)
                await ntxn.save()

            }

            // only add it previous spend was not present
            if (check[0].spent == false) {
                await Txn.findOneAndUpdate({ id: txn.id }, {
                    $set: { spent: true }
                })
            }


            console.log(`new transaction added to db ${JSON.stringify(txn)} -- ${Date()}`)

        } else {
            var ntxn = new Txn();
            ntxn.id = txn.id
            ntxn.pubKey = txn.pubKey
            ntxn.amount = txn.amount
            ntxn.origin = txn.origin
            ntxn.spent = false
            console.log(`new transaction added to db ${JSON.stringify(txn)} -- ${Date()}`)
            await ntxn.save()
        }
    }
}


// get all transactions of user
const getTxns = async (pubKey) => {
    const txns = await Txn.find({ pubKey })

    // signing all txns
    const signedTxns = []
    for (let txn of txns) {

        let signature = JSON.stringify(txn)
        tstamp = Date.now().toString()
        signature += tstamp

        let cbdc_prvKey = fs.readFileSync(`${__dirname}/cbdc-keys/privateKey.pem`).toString()
        signature = crypto.sign('sha256', Buffer.from(signature), cbdc_prvKey).toString('base64')

        signedTxns.push({
            btxn: txn,
            signature,
            tstamp
        })
    }

    return signedTxns
}

// ! currently does not validate signatures
const spendTxns = async (txn) => {
    const txns = []

    if (txn.btxn.amount > txn.amount) {

        //updating the base txn
        txns.push({
            ...txn.btxn,
            spent: true
        })

        // first pushing owner's remaining share
        txns.push({
            id: v4(),
            origin: txn.btxn.id,
            amount: txn.btxn.amount - txn.amount,
            pubKey: txn.btxn.pubKey,
            spent: false
        })

        // pushing the receiver's share
        txns.push({
            id: v4(),
            origin: txn.btxn.id,
            amount: txn.amount,
            pubKey: txn.rpubKey,
            spent: false
        })

    } else {

        txns.push({
            ...txn.btxn,
            spent: true
        })

        txns.push({
            id: v4(),
            origin: txn.btxn.id,
            amount: txn.amount,
            pubKey: txn.rpubKey,
            spent: false
        })
    }
    await addTxnsToDB(txns)
}


module.exports = {
    connectToDB,
    addTxnsToDB,
    getTxns,
    spendTxns
}