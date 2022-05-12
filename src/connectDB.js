// file for cbdc connection to database

const fs = require('fs');
const mongoose = require('mongoose');
const crypto = require('crypto')
const { v4 } = require('uuid')


const TxnSchema = new mongoose.Schema(
    {
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
        timestamps: false,
        versionKey: false,
    })

const Txn = mongoose.model(`txnsCBDC`, TxnSchema, `txnsCBDC`)


const connectToDB = async () => {
    await mongoose.connect('mongodb+srv://pos_node:pos_node@g0-cluster.4szx0.mongodb.net/pos_bk_db?retryWrites=true&w=majority')
}

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
    const txns = await Txn.find({ pubKey, spent: false }).select("-_id")
    return txns
}

const getSignedTxn = async (id) => {
    try {

        await Txn.findOneAndUpdate({ id }, { $set: { spent: true } })
        const txn = await Txn.findOne({ id }).select("-_id")

        let sig_msg = JSON.stringify(txn)
        let tstamp = Date.now().toString()
        sig_msg += tstamp


        let cbdc_prvKey = fs.readFileSync(`${__dirname}/cbdc-keys/privateKey.pem`).toString()
        let signature = crypto.sign('sha256', Buffer.from(sig_msg), cbdc_prvKey).toString('base64')

        return {
            btxn: txn,
            signature,
            tstamp
        }

    } catch (e) {
        throw new Error(e)
    }
}


// gets txn from p2p network, adding it back to CBDC
const addTxnP2C = async (txn) => {
    let tst = JSON.stringify(txn.btxn);
    tst += txn.tstamp;

    let data = Buffer.from(tst)
    const pubKey = fs.readFileSync(`${__dirname}/cbdc-keys/publicKey${txn.id}.pem`, { encoding: 'utf8' })
    const isValid = crypto.verify('sha256', data, pubKey, Buffer.from(txn.signature, 'base64'))
    console.log(isValid)

    if (isValid) {
        const ntxn = new Txn()
        ntxn.id = v4()
        ntxn.amount = txn.btxn.amount
        ntxn.pubKey = txn.btxn.pubKey
        ntxn.spent = false
        ntxn.origin = `p2p - ${txn.btxn.id}`     // explicitly stating that the txn came from p2p
        await ntxn.save();
    }
}

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

const isTxnValidInTxnDB = async (txn) => {
    const txns = await Txn.find({ id: txn.id, pubKey: txn.pubKey })

    if (txns.length == 1 && txns[0].spent == true) {
        return false
    } else {
        return txns.length == 1 ? true : undefined
    }
}


module.exports = {
    connectToDB,
    addTxnsToDB,
    getTxns,
    spendTxns,
    isTxnValidInTxnDB,
    getSignedTxn,
    addTxnP2C,
}