// file that starts the central CBDC

const express = require('express');
const axios = require('axios');
const { v4 } = require('uuid')
const cors = require('cors')

const db = require('./connectDB')


const app = express();

app.use(express.json())
app.use(cors())

const getUTCString = () => {
    return (new Date()).toUTCString()
}

var PHASE = "ONLINE"
var lst_BLOCK = 0

// time to init

let time = new Date()
let utc_min = (new Date()).getUTCMinutes()
utc_min = utc_min + 5 - ((utc_min + 5) % 5)

let yr = time.getUTCFullYear()
let mnt = time.getUTCMonth()
let dt = time.getUTCDate()
let hr = time.getUTCHours()

let tdt = Date.UTC(yr, mnt, dt, hr, utc_min, 1)


// time to init

// query the peer network for txns every 15mins, stay up for 10 min, go temporarily down for 5 mins 
setTimeout(() => {

    setTimeout(() => {
        console.log(`Now server is going offline -- ${getUTCString()}`)
        PHASE = 'OFFLINE'
    }, 10 * 60 * 1000)

    setInterval(() => {
        axios.get(`http://localhost:4000/block/${lst_BLOCK}`)
            .then((blocks => {
                const txns = []
                for (let block of blocks) {
                    txns = [...txns, ...block.transactions]
                }
                db.addTxnsToDB(txns)
                console.log(`Server is not coming back oneline -- ${getUTCString()}`)
                PHASE = 'ONLINE'

                setTimeout(() => {
                    console.log(`Now server is going offline -- ${getUTCString()}`)
                    PHASE = 'OFFLINE'
                }, 10 * 60 * 1000)

            }))
            .catch(e => {
                console.log(e)
            })
    }, 15 * 60 * 1000)
}, tdt - Date.now())


// get all transactions
app.post('/txns', async (req, res) => {
    try {

        const txns = await db.getTxns(req.body.pubKey)
        res.status(400).send(txns)

    } catch (e) {
        console.log(e)
        res.status(400).send()
    }
})


// create users - will create txn with 10000 amount (for testing purposes)
app.post('/create', async (req, res) => {
    try {
        await db.addTxnsToDB([{
            id: v4(),
            pubKey: req.body.pubKey,
            amount: 1000000,
            spent: false,
            origin: "0",
        }])

    } catch (e) {
        console.log(e)
    }
})


app.get('/phase', (_, res) => {
    res.status(200).send(PHASE)
})

app.post('/txn/spend', (req, res) => {
    try {
        if (PHASE == "ONLINE") {

        } else {
            res.status(400).send()
        }

    } catch (e) {
        res.status(400).send()
    }
})


db.connectToDB().then(() => {
    console.log('server is connected to database')
    app.listen(3000, () => { console.log('server is up and running on port 3000') })
})

