// file for adding txns to the database
const { v4 } = require('uuid')
const fs = require('fs')
const mongoose = require('mongoose')

const connectToDB = async () => {
    await mongoose.connect('mongodb+srv://pos_node:pos_node@g0-cluster.4szx0.mongodb.net/pos_bk_db?retryWrites=true&w=majority')
}

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
        timestamps: false,
        versionKey: false
    })

const Txn4 = mongoose.model(`txns${4000}`, TxnSchema, `txns${4000}`)
const Txn5 = mongoose.model(`txns${5000}`, TxnSchema, `txns${5000}`)
const Txn6 = mongoose.model(`txns${6000}`, TxnSchema, `txns${6000}`)
const Txn7 = mongoose.model(`txns${7000}`, TxnSchema, `txns${7000}`)

let pk1 = fs.readFileSync(`${__dirname}/wallet/publicKeyus1.pem`).toString()
let pk2 = fs.readFileSync(`${__dirname}/wallet/publicKeyus2.pem`).toString()
let pk3 = fs.readFileSync(`${__dirname}/wallet/publicKeyus3.pem`).toString()
let pk4 = fs.readFileSync(`${__dirname}/wallet/publicKeyus4.pem`).toString()
let pk5 = fs.readFileSync(`${__dirname}/wallet/publicKeyus5.pem`).toString()

let arr = [pk1, pk2, pk3, pk4, pk5]
let txn = [Txn4, Txn5, Txn6, Txn7]
let id = [v4(), v4(), v4(), v4(), v4()]

connectToDB().then(() => {
    for (let t of txn) {

        let p1, p2, p3, p4, p5;

        p1 = new t()
        p1.id = id[0]
        p1.origin = "0"
        p1.pubKey = arr[0]
        p1.amount = 1000000000
        p1.spent = false


        p2 = new t()
        p2.id = id[1]
        p2.origin = "0"
        p2.pubKey = arr[1]
        p2.amount = 1000000000
        p2.spent = false

        p3 = new t()
        p3.id = id[2]
        p3.origin = "0"
        p3.pubKey = arr[2]
        p3.amount = 1000000000
        p3.spent = false

        p4 = new t()
        p4.id = id[3]
        p4.origin = "0"
        p4.pubKey = arr[3]
        p4.amount = 1000000000
        p4.spent = false

        p5 = new t()
        p5.id = id[4]
        p5.origin = "0"
        p5.pubKey = arr[4]
        p5.amount = 1000000000
        p5.spent = false

        let pms = [p1.save(), p2.save(), p3.save(), p4.save(), p5.save()]

        Promise.all(pms).then(() => {
            console.log('success with ', t)
        })

    }
})
