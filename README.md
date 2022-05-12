# Dummy P2P Network and CBDC Network (To provide a proof of concept)

### P2P Network

Creates a block in 5 mins using a dummy POS network

- Phase Vote (1 mins) : Peers first stake that they want to be part of block creation, then peers vote and a block creator is declared

- Phase Pool (1 mins) : The block creator pools all available txns sent out to the P2P network. Accespt valid transactions and then creates a block and sends it out across the P2P network

- Phase Validate (1 mins) : The remaining stakers then validate the block, after validation, they vote on whether the block is valid or not

- Phase Commit (1 mins): The block is then finally committed by all PEERs to their own copy of the ledger


### CBDC Network

Comprises of one node
- On making an account, with the CBDC, each public key is given 2000 worth of tokens, given in two transactions
- Like the p2p network, can move txns from p2p to c and c to p2p networks