
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.31.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

const { uint, principal, bool, ascii, some } = types;

const dataContract = 'flight-surety-data';
const appContract = 'flight-surety-app';
const AIRLINE_FUNDING = 1000000;

function getAccounts ({accounts}: {accounts: Map<string, Account>}){
    const wallets = [ 'deployer', 'airline_1', 'airline_2', 'airline_3', 'airline_4', 'airline_5', 'airline_6']
    const [deployer, airline1, airline2, airline3, airline4, airline5, airline6] = wallets.map(name => accounts.get(name)!);

    return { deployer, airline1, airline2, airline3, airline4, airline5, airline6 };
}

function whitelistAppContract ({chain, deployer}: {chain: Chain, deployer: Account}) {
   
    const height = chain.blockHeight
    const block = chain.mineBlock([
        whitelistAppContractTx(deployer),
    ]);
    // check if block with tx is mined
    assertEquals(block.receipts.length, 1);
    assertEquals(block.height, height + 1);
    // check if whitelist tx was successfull
    block.receipts[0].result.expectOk().expectBool(true);
    // check read-only "is-whitelisted" equals true
    let check = hasDataAccess(chain, deployer);
    check.result.expectBool(true);

    return { whitelistBlock: block };
}

interface StxTransferEvent {
	type: string,
	stx_transfer_event: {
		sender: string,
		recipient: string,
        amount: string
	}
}

function assertStxTransfer(event: StxTransferEvent, amount: number, sender: string, recipient: string) {
	assertEquals(typeof event, 'object');
	assertEquals(event.type, 'stx_transfer_event');
	event.stx_transfer_event.sender.expectPrincipal(sender);
	event.stx_transfer_event.recipient.expectPrincipal(recipient);
	event.stx_transfer_event.amount.expectInt(amount);
}

const isOperational = (chain: Chain, deployer: Account) =>
    chain.callReadOnlyFn(appContract, "is-operational", [], deployer.address);  // principal(deployer.address.concat('.', appContract))

const hasDataAccess = (chain: Chain, deployer: Account) =>
    chain.callReadOnlyFn(appContract, "has-data-access", [], deployer.address);  // principal(deployer.address.concat('.', appContract))

const setOperatingStatus = (status: boolean, caller: Account) =>
    Tx.contractCall(appContract, "set-operating-status", [bool(status)], caller.address ); 
    
const registeredAirlineCount = (chain: Chain, deployer: Account) =>
    chain.callReadOnlyFn(appContract, "registered-airline-count", [], deployer.address);  // principal(deployer.address.concat('.', appContract))

const getAirline = (chain: Chain, airline: Account, deployer: Account) =>
    chain.callReadOnlyFn(appContract, "get-airline", [principal(airline.address)], deployer.address);  
    
const whitelistAppContractTx = (deployer: Account) =>
    Tx.contractCall(appContract, "whitelist-app-contract", [], deployer.address);  // principal(deployer.address.concat('.', appContract))

const addAirlineTx = (airline: Account, airlineName: string , caller: Account, appSender: Account) =>
    Tx.contractCall(appContract, "add-airline", [principal(airline.address), ascii(airlineName), principal(caller.address)], appSender.address );

const fundAirlineTx = (airline: Account) =>
    Tx.contractCall(appContract, "fund-airline", [], airline.address );


Clarinet.test({
    name: "Ensure that operational status is set correct on deployment and has proper functionality",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1 } = getAccounts({accounts})
        const readState:any[] =  []
        
        readState.push(isOperational(chain, deployer).result) // initial state
        let block = chain.mineBlock([
            setOperatingStatus(false, deployer),         // set false
        ]);
        readState.push(isOperational(chain, deployer).result) // read state
        block = chain.mineBlock([
            setOperatingStatus(true, deployer),          // set true
        ]);
        readState.push(isOperational(chain, deployer).result) // read state
        
        block = chain.mineBlock([
            setOperatingStatus(false, airline1), // try to call with false principal
        ]);
        block.receipts[0].result.expectErr().expectUint(3011)

        assertEquals([ "true", "false", "true" ], readState)
    },    
});

Clarinet.test({
    name: "Ensure that whitelisting of app-contract is working",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer } = getAccounts({accounts})
        // read whitelisting before tx, expect false
        let read = hasDataAccess(chain, deployer)
        read.result.expectBool(false)

        let block = chain.mineBlock([
            whitelistAppContractTx(deployer),
        ]);
        // check successful block mined with correct result
        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 2);
        block.receipts[0].result.expectOk().expectBool(true);
        // read whitelisting after tx, expect true
        read = hasDataAccess(chain, deployer)
        read.result.expectBool(true)
    },
});

Clarinet.test({
    name: "Ensure that whitelisting of app-contract is only possible by deployer",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1 } = getAccounts({accounts})
        // read whitelisting before tx, expect false
        let read = hasDataAccess(chain, deployer)
        read.result.expectBool(false)

        let block = chain.mineBlock([
            whitelistAppContractTx(airline1),
        ]);
        // check successful block mined with correct result
        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 2);
        block.receipts[0].result.expectErr().expectUint(3011);
        // read whitelisting after tx, expect true
        read = hasDataAccess(chain, deployer)
        read.result.expectBool(false)
    },
});

Clarinet.test({
    name: "Ensure that get-airline data is received succesful from data-contract and airline is registered on deployment",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1 } = getAccounts({accounts})
        // expect airline data
        let read = getAirline(chain, airline1, deployer)
        let airlineData = read.result.expectSome().expectTuple()
        airlineData['airline-id'].expectUint(1)
        airlineData['airline-name'].expectAscii("First Airline")
        airlineData['airline-state'].expectUint(2)
        airlineData['voters'].expectList()
        // expect airline data not available (principal not in map)
        read = getAirline(chain, deployer, deployer)
        read.result.expectNone()
    },    

});

Clarinet.test({
    name: "Ensure that an ariline can be added by already registered airline",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1, airline2 } = getAccounts({accounts})
        const { whitelistBlock } = whitelistAppContract({ chain, deployer: deployer} )
        
        // add airline
        let block = chain.mineBlock([
            addAirlineTx(airline2, "Airline 2", airline1, deployer ),
        ]);
        block.receipts[0].result.expectOk().expectTuple();
    },    

});

Clarinet.test({
    name: "Ensure that first three arilines get registered and counter is working properly(by consensus)",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1, airline2, airline3, airline4 } = getAccounts({accounts})
        const { whitelistBlock } = whitelistAppContract({ chain, deployer: deployer} )
        
        // add further 3 Airlines to already on deployment registered airline
        let block = chain.mineBlock([
            addAirlineTx(airline2, "Airline 2", airline1, deployer ),
            addAirlineTx(airline3, "Airline 3", airline1, deployer ),
            addAirlineTx(airline4, "Airline 4", airline1, deployer ),
        ]);
        // Airlines expected to get registered on add
        for (let i = 0; i < 2; i++) {
            let tuple = block.receipts[i].result.expectOk().expectTuple()
            tuple['airline-state'].expectUint(2)
            tuple['reg-airlines'].expectUint(2 + i) // expect 2 registered airlines in first receipt    
        }
        // Airline 4 not registered and in "Application" state
        let tuple = block.receipts[2].result.expectOk().expectTuple()
            tuple['airline-state'].expectUint(1)
            tuple['reg-airlines'].expectUint(3) 
        },    
});

Clarinet.test({
    name: "Ensure that airline id counter is working properly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1, airline2, airline3, airline4, airline5 } = getAccounts({accounts})
        const { whitelistBlock } = whitelistAppContract({ chain, deployer: deployer} )

        let block = chain.mineBlock([
            addAirlineTx(airline2, "Airline 2", airline1, deployer ),
            addAirlineTx(airline3, "Airline 3", airline2, deployer ),
            addAirlineTx(airline4, "Airline 4", airline3, deployer ),
            addAirlineTx(airline5, "Airline 5", airline4, deployer ),
        ]);
        // id counter test
        for (let i = 0; i < 2; i++) {
            let tuple = block.receipts[i].result.expectOk().expectTuple()
            tuple['airline-id'].expectUint(2 + i) 
        }
    },    
});

Clarinet.test({
    name: "Ensure that add-airline asserts are working properly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1, airline2, airline3, airline4, airline5 } = getAccounts({accounts})
        const { whitelistBlock } = whitelistAppContract({ chain, deployer: deployer} )

        let block = chain.mineBlock([
            addAirlineTx(airline2, "Airline 2", airline1, deployer ),
            addAirlineTx(airline3, "Airline 3", airline2, deployer ),
            addAirlineTx(airline4, "Airline 4", airline3, deployer ),   // add first airline to Application state
            addAirlineTx(airline5, "Airline 5", airline4, deployer ),   // 1. call by not registered airline
            addAirlineTx(airline2, "Airline 2", airline1, deployer ),   // 2. added airline already registered
            addAirlineTx(airline4, "Airline 4", airline3, deployer ),   // 3. caller already voted on added airline
        ]);
    
        block.receipts[3].result.expectErr().expectUint(3004)   // 1. call by not registered airline
        block.receipts[4].result.expectErr().expectUint(3003)   // 2. added airline already registered
        block.receipts[5].result.expectErr().expectUint(3007)   // 3. caller already voted on added airline
    },    
});

Clarinet.test({
    name: "Ensure that voting and consensus from application to registration is working properly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1, airline2, airline3, airline4, airline5, airline6 } = getAccounts({accounts})
        const { whitelistBlock } = whitelistAppContract({ chain, deployer: deployer} )

        let block = chain.mineBlock([
            // add first registered airlines 
            addAirlineTx(airline2, "Airline 2", airline1, deployer ),
            addAirlineTx(airline3, "Airline 3", airline2, deployer ),
            // vote on 4. airline: 2 votes required
            addAirlineTx(airline4, "Airline 4", airline3, deployer ),   
            addAirlineTx(airline4, "Airline 4", airline2, deployer ),
            // vote on 5. airline: 2 votes required
            addAirlineTx(airline5, "Airline 5", airline4, deployer ),
            addAirlineTx(airline5, "Airline 5", airline3, deployer ),
            // vote on 6. airline: 3 votes required
            addAirlineTx(airline6, "Airline 6", airline5, deployer ),
            addAirlineTx(airline6, "Airline 6", airline4, deployer ),
            addAirlineTx(airline6, "Airline 6", airline3, deployer ),
        ]);
        // check last receipt results
        let tuple = block.receipts[8].result.expectOk().expectTuple()
        tuple['airline-state'].expectUint(2)
        tuple['reg-airlines'].expectUint(6)
        tuple['votes'].expectUint(3)
        // check read-only result
        let read = registeredAirlineCount(chain, deployer)
        read.result.expectUint(6)
    },    
});

// airline funding
Clarinet.test({
    name: "Ensure that airline funding is working properly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1} = getAccounts({accounts})
        const { whitelistBlock } = whitelistAppContract({ chain, deployer: deployer} )

        let block = chain.mineBlock([
            fundAirlineTx(airline1),
        ]);
        // tx result ok
        block.receipts[0].result.expectOk().expectBool(true)
        // expect airline state u3 "Funded"
        let read = getAirline(chain, airline1, deployer)
        let airlineData = read.result.expectSome().expectTuple()
        airlineData['airline-state'].expectUint(3)
        // Stx transfer successfull
        assertStxTransfer(block.receipts[0].events[0], AIRLINE_FUNDING, airline1.address, deployer.address.concat('.', dataContract));
    },    
});

