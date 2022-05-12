// every phase is executed within their intervals
// code for dummy project, setup proof of stake on localhost

/**
 * Description of a simple proof of stake network
 * 
 * stages in committing a block (each phase is 1 minute)
 * 
 * - voting phase (peers decide on block creator): 
 * -> will stake, put themselves up for election 30s 
 * -> committer will be decided on 30s -> check starts last 5 secs
 * 
 * - pooling phase: (block creator pools transactions)
 * -> pool the txns 30s
 * -> create block  20s
 * -> send out block 10s (will only be sent out to stakers)
 * 
 * - validation phase (stakers or validators will validate block): 
 * -> each staked peer will validate transactions 30s
 * -> send out signatures to commiter to finalize the block 15s
 * -> committer will create final block with signatures 15s
 * 
 * - committing phase: 
 * -> verify sign on block 30s (done by validators)
 * -> if block has errors, create new block, which marks commiter has the one who made error 20s
 * -> else remove transactions from pool 20s
 * 
 * - waiting phase:
 * -> one minute waiting phase
 * -> just for maintaining everyting within 5 minutes
 */


const fs = require('fs');
const axios = require("axios")
const crypto = require("crypto");
const merkle = require('merkle-lib/fastRoot')
const { v4 } = require('uuid')

const { isTxnValidInTxnDB, addToBlockChainDB, getLastBlock } = require("./connectDB")


// === init peer === //

var CURRENT_PHASE = {
    phase: "INIT",
    block: {},
    bkCrt: undefined,
    bkVfRes: false,
    stakers: 0,
    poold_TXNS: []
}

const PEER_ID = process.argv[2].toString()
const NETWORK_PEERS = ['4000', '5000', '6000', '7000'].filter(id => id != PEER_ID)
const CBDC_PUB = fs.readFileSync(`${__dirname}/cbdc_pub.pem`).toString()

// =^= init peer =^= //


// === utilities === //

const getUTCString = () => {
    return (new Date()).toUTCString()
}

// give id and pool txn
const propagateTxn = async (txn) => {
    txn["id"] = v4()        // creating an id for the transaction


    const axPostReqs = []
    // now propagating the txn through the peer network
    for (let peer of NETWORK_PEERS) {
        axPostReqs.push(axios.post(`http://localhost:${peer}/txn`, txn))
    }

    await axios.all(axPostReqs)

    console.log(`propaged txn through network ${JSON.stringify(txn)} -- ${getUTCString()}`)

    return txn
}

const sha256 = (data) => {
    return crypto.createHash("sha256").update(data).digest()
}

// =^= utilities =^= //


class Vote {
    publicKey;
    privateKey;
    #ballot = []    // ! validity code not implemented
    #noms = []      // ! validity code not implemented

    constructor(publicKey, privateKey) {
        this.publicKey = publicKey
        this.privateKey = privateKey
    }

    /**
     * stake structure
     * {
     *  id: PEER_ID,
     *  tstamp: Date.now(),
     *  signature: id||tstamp
     * }
     * 
     * @description
     * send out stake to all nodes, registration for being a validator
     */

    async #sendOutStake() {
        console.log(`In staking phase -- ${getUTCString()}`)
        CURRENT_PHASE.phase = "VOTE"
        CURRENT_PHASE.bkCrt = undefined

        let tstamp = Date.now().toString();
        let sig_msg = PEER_ID + tstamp
        sig_msg = Buffer.from(sig_msg)

        let signature = crypto.sign("sha256", sig_msg, this.privateKey).toString('base64')

        const stake = {
            id: PEER_ID,
            tstamp,
            signature
        }

        console.log(`sending out stake -- ${JSON.stringify(stake)} -- ${getUTCString()}`)
        this.#ballot.push(PEER_ID)

        try {
            for (let peer of NETWORK_PEERS) {
                await axios.post(`http://localhost:${peer}/vote/stake`, stake)
            }

        } catch (e) {
            console.log(e)
        }

    }

    /**
     * vote structure
     * {
     *   id:
     *   tstamp:
     *   vote:
     *   signature: id||tstamp||vote
     * }
     * @description
     * send out your vote to all peers
     */
    async #sendOutVote() {
        console.log(`In vote sending phase -- ${getUTCString()}`)
        this.#ballot = this.#ballot.filter((item, index) => this.#ballot.indexOf(item) === index)   // removing duplicates

        this.#ballot.sort()

        let tstamp = Date.now().toString()
        let vote = parseInt(Math.floor(Math.random() * this.#ballot.length))
        let sig_msg = PEER_ID + tstamp + vote.toString()
        sig_msg = Buffer.from(sig_msg)

        let signature = crypto.sign("sha256", sig_msg, this.privateKey).toString('base64')

        const voteV = {
            id: PEER_ID,
            tstamp,
            vote,
            signature
        }

        console.log(`sending out vote -- ${JSON.stringify(voteV)} -- ${getUTCString()}`)
        this.#noms.push(vote)   // storing my vote

        try {
            for (let peer of NETWORK_PEERS) {
                await axios.post(`http://localhost:${peer}/vote/vote`, voteV)
            }

        } catch (e) {
            console.log(e)
        }

        setTimeout(() => {
            this.#detBlockCrt()
        }, 25000)

    }


    /**
     * @description add peer as validator
     * @param {{id:String, tstamp:String, signature:String}} stake peer Stake
     */
    addStake(stake) {

        console.log(`received stake -- ${JSON.stringify(stake)} -- ${getUTCString()}`)

        try {
            let stakerID = stake.id
            let tstamp = stake.tstamp
            let signature = Buffer.from(stake.signature, "base64")
            let sig_msg = Buffer.from(stakerID + tstamp)
            let staker_pubKey = fs.readFileSync(`${__dirname}/${PEER_ID}/publicKey${stakerID}.pem`).toString()

            let isValid = crypto.verify("sha256", sig_msg, staker_pubKey, Buffer.from(signature, 'base64'))

            if (isValid) {
                console.log("added valid stake to ballot")
                this.#ballot.push(stakerID)
            } else {
                console.log("could not add invalid stake to ballot")
            }

        } catch (e) {
            console.log(e)
        }

    }

    /**
     * @description add vote from peer
     * @param {{id:String, tstamp:String, signature:String}} vote peer vote
     */

    addVote(vote) {

        console.log(`received vote -- ${JSON.stringify(vote)} -- ${getUTCString()}`)

        try {
            let stakerID = vote.id
            let tstamp = vote.tstamp
            let vote_r = vote.vote
            let signature = Buffer.from(vote.signature, "base64")

            let sig_msg = Buffer.from(stakerID + tstamp + vote_r)
            let staker_pubKey = fs.readFileSync(`${__dirname}/${PEER_ID}/publicKey${stakerID}.pem`).toString()

            let isValid = crypto.verify("sha256", sig_msg, staker_pubKey, Buffer.from(signature, 'base64'))

            if (isValid) {

                this.#noms.push(vote_r)
                console.log("added valid vote to nominees")

            } else {
                console.log("could not add invalid vote to nominees")
            }

        } catch (e) {
            console.log(e)
        }
    }

    /**
     * determine the block committer
     */

    #detBlockCrt() {

        if (this.#noms.length == this.#ballot.length) {
            let sum_of_votes = 0
            this.#noms.forEach(val => sum_of_votes += parseInt(val))

            let blockCreator = sum_of_votes % this.#ballot.length
            console.log(`block creator is -- ${this.#ballot[blockCreator]} -- ${getUTCString()}`)

            CURRENT_PHASE.bkCrt = this.#ballot[blockCreator]
            CURRENT_PHASE.stakers = this.#ballot.length

            // setting up for new ballot
            this.#ballot = []
            this.#noms = []

        }

    }

    #setupVotePhaseInterval() {

        // setup sending out stakes

        setTimeout(() => {

            this.#sendOutStake()
                .catch(e => {
                    console.log(`error in sending out stake -- ${e.message} -- ${getUTCString()}`)
                })

            // send out stake again in 5 mins
            setInterval(() => {
                this.#sendOutStake()
                    .catch(e => {
                        console.log(`error in sending out stake -- ${e.message} -- ${getUTCString()}`)
                    })
            }, 5 * 60 * 1000)

        }, 2000)

        // setup sending out votes after 29 seconds
        setTimeout(() => {
            this.#sendOutVote()
                .catch(e => {
                    console.log(`error in sending out vote -- ${e.message} -- ${getUTCString()}`)
                })

            setInterval(() => {
                this.#sendOutVote()
                    .catch(e => {
                        console.log(`error in sending out vote -- ${e.message} -- ${getUTCString()}`)
                    })
            }, 5 * 1000 * 60)

        }, 30 * 1000)

    }

    /**
     * sets up vote calculation within intervals
     * @param {Date} time 
     */
    init(time) {
        let utc_min = time.getUTCMinutes()
        utc_min = utc_min + 5 - ((utc_min + 5) % 5)

        let yr = time.getUTCFullYear()
        let mnt = time.getUTCMonth()
        let dt = time.getUTCDate()
        let hr = time.getUTCHours()

        let tdt = Date.UTC(yr, mnt, dt, hr, utc_min, 1)
        let time_to_init = tdt - Date.now()

        setTimeout(() => {
            this.#setupVotePhaseInterval()
        }, time_to_init)

    }
}


class Pool {
    publicKey;
    privateKey;
    static TXNS;
    #final_TXNS;

    constructor(publicKey, privateKey,) {
        this.publicKey = publicKey
        this.privateKey = privateKey
        Pool.TXNS = []
    }

    // remove transactions that have been validated
    static updatePoolTXNS() {
        console.log("=== in removing transactions phase ===")
        console.log(`\nall pooled txns -- ${JSON.stringify(CURRENT_PHASE.poold_TXNS)}`)
        console.log(`\nall transactions -- ${JSON.stringify(this.TXNS)}`)

        this.TXNS = this.TXNS.filter(txn => {
            let ind = CURRENT_PHASE.poold_TXNS.indexOf(ptxn => {
                txn.id == ptxn.id
            })
            return ind != -1
        })
        console.log(`removed transactions, remaining are ${JSON.stringify(this.TXNS)} -- ${getUTCString()}`)
    }

    /**
     * used to get finalized transactions
     */
    static finalizeTxns(txns, acmTxns) {
        const finalTxns = []

        let i = 0 // need to assign the same id
        try {

            for (let txn of txns) {

                if (txn.btxn.amount > txn.amount) {

                    //updating the base txn
                    finalTxns.push({
                        ...txn.btxn,
                        spent: true
                    })
                    i += 1

                    // first pushing owner's remaining share
                    finalTxns.push({
                        id: acmTxns[i]["id"],
                        origin: txn.btxn.id,
                        amount: txn.btxn.amount - txn.amount,
                        pubKey: txn.btxn.pubKey,
                        spent: false
                    })
                    i += 1

                    // pushing the receiver's share
                    finalTxns.push({
                        id: acmTxns[i]["id"],
                        origin: txn.btxn.id,
                        amount: txn.amount,
                        pubKey: txn.rpubKey,
                        spent: false
                    })
                    i += 1


                } else {

                    finalTxns.push({
                        ...txn.btxn,
                        spent: true
                    })
                    i += 1

                    finalTxns.push({
                        id: acmTxns[i].id,
                        origin: txn.btxn.id,
                        amount: txn.amount,
                        pubKey: txn.rpubKey,
                        spent: false
                    })
                    i += 1
                }
            }
        } catch (e) {
            console.log(e)
        }

        console.log(`txns accumulated by ${PEER_ID} from receiving pool: ${JSON.stringify(finalTxns)} -- ${getUTCString()}`)

        return finalTxns
    }


    /**
     * check whether txns in block are valid or not
     */
    static async checkTxns(txns) {
        let check = true

        for (let txn of txns) {

            let og_txn = txn["btxn"]

            let tst = JSON.stringify(og_txn)
            tst += txn.rpubKey
            tst += txn.amount.toString()

            let data = Buffer.from(tst)

            const isValidUsr = crypto.verify("sha256", data, og_txn["pubKey"], Buffer.from(txn["signature"], 'base64'))
            const isValidDB = await isTxnValidInTxnDB(og_txn)

            // txn is in the db, txn is not spent
            if (isValidDB && txn.btxn.amount >= txn.amount && isValidUsr) {
                continue
            }

            check = false
            break

        }

        return check
    }
    /**
     * @description 
     * Add a transaction to the transaction pool
     * @param {*} txn transaction
     */

    async addtoTxnsPool(txn) {
        console.log(`received txn ${JSON.stringify(txn)} -- ${getUTCString()}`)

        if (txn["id"] == undefined) {
            txn = await propagateTxn(txn)
        }

        Pool.TXNS.push(txn)
    }

    async #poolTransactions() {
        console.log(`In pool transaction phase -- ${getUTCString()}`)
        CURRENT_PHASE.phase = "POOL"


        // pool transactions if you are bk creator
        if (CURRENT_PHASE.bkCrt == PEER_ID) {

            const newPool = []
            const txns = [...Pool.TXNS]

            let i = 0;

            while (i < 10 && txns.length != 0) {

                let txn = txns.shift()
                let og_txn = txn["btxn"]

                let tst = JSON.stringify(og_txn)
                tst += txn.rpubKey
                tst += txn.amount.toString()

                let data = Buffer.from(tst)

                const isValidUsr = crypto.verify("sha256", data, og_txn["pubKey"], Buffer.from(txn["signature"], 'base64'))
                const isValidDB = await isTxnValidInTxnDB(og_txn)

                // txn is in the db, txn is not spent
                if (isValidDB && parseInt(txn.btxn.amount) >= parseInt(txn.amount) && isValidUsr) {
                    newPool.push(txn)
                    i += 1
                }

            }

            console.log(`transactions selected by ${PEER_ID}: ${JSON.stringify(newPool)} -- ${getUTCString()}`)
            CURRENT_PHASE.poold_TXNS = newPool
        }
    }

    /**
    * @description
    * create new unspent transactions and spent prev base txn
    */
    #finalizeTransactions() {
        const finalTxns = []
        for (let txn of CURRENT_PHASE.poold_TXNS) {

            if (txn.btxn.amount > txn.amount) {


                finalTxns.push({
                    ...txn.btxn,
                    spent: true
                })


                // pushing owner's remaining share
                finalTxns.push({
                    id: v4(),
                    origin: txn.btxn.id,
                    amount: txn.btxn.amount - txn.amount,
                    pubKey: txn.btxn.pubKey,
                    spent: false
                })

                // pushing the receiver's share
                finalTxns.push({
                    id: v4(),
                    origin: txn.btxn.id,
                    amount: txn.amount,
                    pubKey: txn.rpubKey,
                    spent: false
                })

            } else {

                finalTxns.push({
                    ...txn.btxn,
                    spent: true
                })

                finalTxns.push({
                    id: v4(),
                    origin: txn.btxn.id,
                    amount: txn.amount,
                    pubKey: txn.rpubKey,
                    spent: false
                })
            }
        }

        console.log(`transactions accumulated by ${PEER_ID}: ${JSON.stringify(finalTxns)} -- ${getUTCString()}`)

        this.#final_TXNS = finalTxns
    }

    async #createBlock() {
        console.log(`In create block phase -- ${getUTCString()}`)

        // only create block if you are block crt
        if (CURRENT_PHASE.bkCrt == PEER_ID) {
            //finalizing txns
            this.#finalizeTransactions()

            let txnsBuf = this.#final_TXNS.map(v => Buffer.from(JSON.stringify(v)))
            // adding two random values
            txnsBuf.push(crypto.randomBytes(64))
            txnsBuf.push(crypto.randomBytes(64))

            const merkleRoot = merkle(txnsBuf, sha256)     // calculating the merkle tree

            const lastBlock = await getLastBlock()
            const lastBlock_id = lastBlock.id
            const prevHash = lastBlock.hash


            const newBlock = {
                id: parseInt(lastBlock_id) + 1,
                transactions: this.#final_TXNS,
                merkleRoot: merkleRoot.toString("hex"),
                tstamp: Date.now().toString(),
                prevHash,
                hash: "",
                committer: PEER_ID,
                signature: "",
                endorsers: []
            }

            let tst = newBlock.id.toString() + newBlock.merkleRoot + newBlock.prevHash + newBlock.tstamp

            const hash = sha256(Buffer.from(tst))
            newBlock.hash = hash.toString("hex")

            const blockSignature = crypto.sign("sha256", Buffer.from(newBlock.hash), this.privateKey)
            newBlock.signature = blockSignature.toString('base64')

            CURRENT_PHASE.block = newBlock
            console.log(`generated new block by ${PEER_ID} -- ${JSON.stringify(CURRENT_PHASE.block)} -- ${getUTCString()}`)
        }

    }

    async #sendOutBlock() {
        console.log(`In sending out block phase -- ${getUTCString()}`)

        // only send out if you are block crt
        if (CURRENT_PHASE.bkCrt == PEER_ID) {

            // all final txns hash
            const txnHash = sha256(Buffer.from(JSON.stringify(this.#final_TXNS))).toString("hex")
            try {
                for (let peer of NETWORK_PEERS) {
                    await axios.post(`http://localhost:${peer}/block`, {
                        block: CURRENT_PHASE.block,
                        txnHash,
                        poold_TXNS: CURRENT_PHASE.poold_TXNS
                    })
                }

            } catch (e) {
                console.log(e)
            }
        }
    }

    #setupPoolPhaseInterval() {
        // setup pooling txns

        setTimeout(() => {

            this.#poolTransactions()
                .catch((e) => console.log(e))

            setInterval(() => {
                this.#poolTransactions()
                    .catch((e) => console.log(e))
            }, 5 * 60 * 1000)

        }, 2000 + 60000)

        // create block after 29 seconds
        setTimeout(() => {
            this.#createBlock()
                .catch((e) => console.log(e))

            setInterval(() => {
                this.#createBlock()
                    .catch((e) => console.log(e))
            }, 5 * 60 * 1000)

        }, 30 * 1000 + 60000)

        // send out block after 49 seconds
        setTimeout(() => {
            this.#sendOutBlock()

            setInterval(() => {
                this.#sendOutBlock()
            }, 5 * 60 * 1000)

        }, 49 * 1000 + 60000)
    }

    init(time) {
        let utc_min = time.getUTCMinutes()
        utc_min = utc_min + 5 - ((utc_min + 5) % 5)

        let yr = time.getUTCFullYear()
        let mnt = time.getUTCMonth()
        let dt = time.getUTCDate()
        let hr = time.getUTCHours()

        let tdt = Date.UTC(yr, mnt, dt, hr, utc_min, 1)
        let time_to_init = tdt - Date.now()

        setTimeout(() => {
            this.#setupPoolPhaseInterval()
        }, time_to_init)
    }
}


class Validate {
    publicKey;
    privateKey;
    #txnHash;

    constructor(publicKey, privateKey) {
        this.publicKey = publicKey
        this.privateKey = privateKey
    }

    /**
     * @param {Object} block_info contains block info, txn hash and pooled txns 
     */

    updateBlock({ block, txnHash, poold_TXNS }) {
        // add purposeful logs
        console.log(`received new block info ${JSON.stringify(block)} -- ${getUTCString()}`)

        CURRENT_PHASE.block = block // updates non block crt's current phase

        this.#txnHash = txnHash
        CURRENT_PHASE.poold_TXNS = poold_TXNS

    }


    /**
     * for adding vote to block signatories
     * 
     */
    addToBlockSnts(vote) {

        console.log(`received block vote -- ${JSON.stringify(vote)} -- ${getUTCString()}`)
        const voter_pubKey = fs.readFileSync(`${__dirname}/${PEER_ID}/publicKey${vote.id}.pem`)
        const data = vote.id.toString() + CURRENT_PHASE.block.hash + "yes"
        const isValid = crypto.verify('sha256', Buffer.from(data), voter_pubKey, Buffer.from(vote.signature, 'base64'))

        if (isValid) {
            console.log('adding valid block vote to block')
            CURRENT_PHASE.block.endorsers.push(vote)
        } else {
            console.log('could not add invalid block vote to block')
        }

    }

    async #validateBlockTransactions() {
        console.log(`In validate block txns phase -- ${getUTCString()}`)

        CURRENT_PHASE.phase = "VALIDATE"

        // validate if you are not block creator
        if (CURRENT_PHASE.bkCrt != PEER_ID) {

            // checking block height
            const lastBlock = await getLastBlock()
            if (lastBlock.id + 1 != CURRENT_PHASE.block.id) {
                CURRENT_PHASE.bkVfRes = false
                console.log(`received block is invalid (id failure) -- ${getUTCString()}`)
                return
            }

            let tst = CURRENT_PHASE.block.id.toString() + CURRENT_PHASE.block.merkleRoot + CURRENT_PHASE.block.prevHash + CURRENT_PHASE.block.tstamp
            let bkCrt_pubkey = fs.readFileSync(`${__dirname}/${PEER_ID}/publicKey${CURRENT_PHASE.bkCrt}.pem`)

            let buf = Buffer.from(sha256(tst).toString('hex'))
            let valid = crypto.verify("sha256", buf, bkCrt_pubkey, Buffer.from(CURRENT_PHASE.block.signature, 'base64'))

            if (!valid) {
                CURRENT_PHASE.bkVfRes = false
                console.log(`received block is invalid (signature failure) -- ${getUTCString()}`)
                return
            }

            // check if all transactions included are valid or not
            valid = Pool.checkTxns(CURRENT_PHASE.poold_TXNS)
            if (!valid) {
                CURRENT_PHASE.bkVfRes = false
                console.log(`received block is invalid (txns not valid) -- ${getUTCString()}`)
                return
            }

            // check transactions
            const txns = Pool.finalizeTxns(CURRENT_PHASE.poold_TXNS, CURRENT_PHASE.block.transactions)
            const hash = sha256(Buffer.from(JSON.stringify(txns))).toString('hex')

            if (!(hash == this.#txnHash)) {
                CURRENT_PHASE.bkVfRes = false
                console.log(`received block is invalid (txn hash failure) -- ${getUTCString()}`)
                return
            }

            console.log(`received block is valid -- ${getUTCString()}`)
            CURRENT_PHASE.bkVfRes = true
        }
    }

    async #signBlock() {
        console.log(`In sign block phase -- ${getUTCString()}`)

        if (CURRENT_PHASE.bkVfRes && PEER_ID != CURRENT_PHASE.bkCrt) {

            let msg = PEER_ID.toString() + CURRENT_PHASE.block.hash + "yes"
            let signature = crypto.sign('sha256', Buffer.from(msg), this.privateKey).toString('base64')

            const signPayload = {
                id: PEER_ID,
                signature
            }

            console.log(`Sending out yes block vote to ${CURRENT_PHASE.bkCrt} -- ${getUTCString()}`)
            await axios.post(`http://localhost:${CURRENT_PHASE.bkCrt}/block/vote`, signPayload)

        }
    }

    async #addPeerSignToBlock() {
        console.log(`In add peer signs to block phase -- ${getUTCString()}`)
        console.log(CURRENT_PHASE.bkCrt, PEER_ID)

        // only sent out by bk creator
        if (CURRENT_PHASE.bkCrt == PEER_ID) {
            console.log(`added signatures to block -- ${JSON.stringify(CURRENT_PHASE.block.endorsers)} -- ${getUTCString()}`)
            console.log("sending out block to peers")
            for (let peer of NETWORK_PEERS) {
                await axios.post(`http://localhost:${peer}/commit/block`, CURRENT_PHASE.block)
            }
        }
    }

    #setupValidatePhaseInterval() {


        setTimeout(() => {

            this.#validateBlockTransactions()
                .catch(e => console.log(e))

            setInterval(() => {
                this.#validateBlockTransactions()
                    .catch(e => console.log(e))
            }, 5 * 60 * 1000)

        }, 2000 + 120000)

        // sign block 29 seconds
        setTimeout(() => {
            this.#signBlock()
                .catch(e => console.log(e))

            setInterval(() => {
                this.#signBlock()
                    .catch(e => console.log(e))

            }, 5 * 60 * 1000)

        }, 30 * 1000 + 120000)

        // send out block after 44 seconds
        setTimeout(() => {
            this.#addPeerSignToBlock()
                .catch(e => console.log(e))

            setInterval(() => {
                this.#addPeerSignToBlock()
                    .catch(e => console.log(e))
            }, 5 * 60 * 1000)

        }, 44 * 1000 + 120000)

    }

    init(time) {
        let utc_min = time.getUTCMinutes()
        utc_min = utc_min + 5 - ((utc_min + 5) % 5)

        let yr = time.getUTCFullYear()
        let mnt = time.getUTCMonth()
        let dt = time.getUTCDate()
        let hr = time.getUTCHours()

        let tdt = Date.UTC(yr, mnt, dt, hr, utc_min, 1)
        let time_to_init = tdt - Date.now()

        setTimeout(() => {
            this.#setupValidatePhaseInterval()
        }, time_to_init)
    }
}


class Commit {
    publicKey;
    privateKey;

    constructor(publicKey, privateKey) {
        this.publicKey = publicKey
        this.privateKey = privateKey
    }

    updateBlock(block) {
        console.log(`received block with signatories -- ${JSON.stringify(block)} -- ${getUTCString()}`)
        CURRENT_PHASE.block.endorsers = block.endorsers  // updating the endorsers
    }


    // verify the signature of endorsers
    #verifyBlockSigns() {
        console.log(`In verify block sign phase -- ${getUTCString()}`)

        if (CURRENT_PHASE.bkCrt != PEER_ID) {
            let valid_endorsers = []

            for (let endorser of CURRENT_PHASE.block.endorsers) {
                let sig_msg = endorser.id.toString() + CURRENT_PHASE.block.hash + "yes"
                sig_msg = Buffer.from(sig_msg)
                let signature = Buffer.from(endorser.signature, 'base64')
                let endorser_pubKey;
                let isValid;

                if (endorser.id.toString() != PEER_ID) {
                    endorser_pubKey = fs.readFileSync(`${__dirname}/${PEER_ID}/publicKey${endorser.id.toString()}.pem`).toString()
                    isValid = crypto.verify('sha256', sig_msg, endorser_pubKey, signature)
                } else {
                    isValid = CURRENT_PHASE.bkVfRes
                }

                if (isValid) {
                    valid_endorsers.push(endorser)
                }
            }

            console.log(`valid signatures found -- ${JSON.stringify(valid_endorsers)} -- ${getUTCString()}`)
            CURRENT_PHASE.block.endorsers = valid_endorsers     // updating block with only valid endorsers

            // if number of valid endorsers is less than the minimum
            if (!(valid_endorsers.length >= Math.floor(CURRENT_PHASE.stakers / 2) + 1)) {
                CURRENT_PHASE.block.transactions = []
                CURRENT_PHASE.poold_TXNS = []
            }
        }
    }

    async #addBlockToChain() {
        console.log(`In add block to chain phase -- ${getUTCString()}`)

        try {
            await addToBlockChainDB(CURRENT_PHASE.block)
            console.log(`Added to the blockchain ${JSON.stringify(CURRENT_PHASE.block)} -- ${getUTCString()}`)

            Pool.updatePoolTXNS()   // remove transactions from commit

            // resetting current phase

            CURRENT_PHASE = {
                phase: "INIT",
                block: {},
                bkCrt: undefined,
                bkVfRes: false,
                stakers: 0,
                poold_TXNS: []
            }


        } catch (e) {
            console.log(e)
        }
    }

    #setupCommitPhaseInterval() {

        setTimeout(() => {

            this.#verifyBlockSigns()

            setInterval(() => {
                this.#verifyBlockSigns()
            }, 5 * 60 * 1000)

        }, 2000 + 180000)

        // sign block 29 seconds
        setTimeout(() => {
            this.#addBlockToChain()

            setInterval(() => {
                this.#addBlockToChain()
            }, 5 * 60 * 1000)

        }, 30 * 1000 + 180000)
    }

    init(time) {
        let utc_min = time.getUTCMinutes()
        utc_min = utc_min + 5 - ((utc_min + 5) % 5)

        let yr = time.getUTCFullYear()
        let mnt = time.getUTCMonth()
        let dt = time.getUTCDate()
        let hr = time.getUTCHours()

        let tdt = Date.UTC(yr, mnt, dt, hr, utc_min, 1)
        let time_to_init = tdt - Date.now()

        setTimeout(() => {
            this.#setupCommitPhaseInterval()
        }, time_to_init)
    }
}


module.exports = {
    Vote,
    Pool,
    Validate,
    Commit,
    utility: {
        getUTCString,
        propagateTxn,
        getLastBlock
    }
}