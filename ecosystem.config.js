// file for running pm2 proces

module.exports = {
    apps: [
        {
            name: "london",
            script: "./src/pos-server/server.js",
            args: "4000"
        },
        {
            name: "paris",
            script: "./src/pos-server/server.js",
            args: "5000"
        },
        {
            name: "tokyo",
            script: "./src/pos-server/server.js",
            args: "6000"
        },
        {
            name: "nyc",
            script: "./src/pos-server/server.js",
            args: "7000"
        },
        {
            name: "delhi",
            script: "./src/index.js"
        },
        {
            name: "kokrajhar",
            script: "./src/randTxns/createRanTxns.js"
        }
    ]
}