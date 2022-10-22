
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.31.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

const { uint, principal, bool, ascii, tuple, int } = types;

const dataContract = 'flight-surety-data';
const appContract = 'flight-surety-app';

function getAccounts ({accounts}: {accounts: Map<string, Account>}){
    const wallets = [ 'deployer', 'airline_1', 'airline_2', 'airline_3', 'airline_4', 'airline_5', 'airline_6', 'customer_1', 'customer_2']
    const [deployer, airline1, airline2, airline3, airline4, airline5, airline6, customer1, customer2] = wallets.map(name => accounts.get(name)!);

    return { deployer, airline1, airline2, airline3, airline4, airline5, airline6, customer1, customer2 };
}

function getTestParameters() {
    const airlineFundAmount = 500000000;  // STX amount to pay by airline to get state funded
    const flightNumber = "SK1234"
    const departure = 1667236005; // unix timestamp flight departure time
    const maxPayout = 1000000
    const purchaseAmount = 8000

    return { airlineFundAmount, flightNumber, departure, maxPayout, purchaseAmount}
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
    chain.callReadOnlyFn(appContract, "airlines-count", [], deployer.address);  // principal(deployer.address.concat('.', appContract))

const getAirline = (chain: Chain, airline: Account, deployer: Account) =>
    chain.callReadOnlyFn(appContract, "get-airline", [principal(airline.address)], deployer.address);
    
const getFlight = (chain: Chain, airlineId: number, flightId: string ,sender: Account) =>
    chain.callReadOnlyFn(appContract, "get-flight", [uint(airlineId), ascii(flightId)], sender.address);

const getSurety = (chain: Chain, insuree: Account, flightId: number) =>
    chain.callReadOnlyFn(appContract, "get-surety", [principal(insuree.address), uint(flightId)], insuree.address);

    
const whitelistAppContractTx = (deployer: Account) =>
    Tx.contractCall(appContract, "whitelist-app-contract", [], deployer.address);  // principal(deployer.address.concat('.', appContract))

const addAirlineTx = (airline: Account, airlineName: string , caller: Account, appSender: Account) =>
    Tx.contractCall(appContract, "add-airline", [principal(airline.address), ascii(airlineName), principal(caller.address)], appSender.address );

const fundAirlineTx = (airline: Account) =>
    Tx.contractCall(appContract, "fund-airline", [], airline.address );

const registerFlightTx = (airline: Account, flightId: string, payouts: any, maxPayout: number, activate: boolean ) =>
    Tx.contractCall(appContract, "register-flight", [ascii(flightId), tuple(payouts), uint(maxPayout), bool(activate)], airline.address );

const purchaseSuretyTx = ( flightId: number , departure: number, amount: number, sender: Account) =>
    Tx.contractCall(appContract, "purchase-surety", [uint(flightId), int(departure), uint(amount)],  sender.address );

const updateFlightTx = (flightId: number , departure: number, status: number,  sender: Account) =>
    Tx.contractCall(appContract, "update-flight", [ uint(flightId), int(departure), uint(status)],  sender.address );


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
        whitelistAppContract({ chain, deployer: deployer} )
        
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
        whitelistAppContract({ chain, deployer: deployer} )

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
        whitelistAppContract({ chain, deployer: deployer} )
        
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
        whitelistAppContract({ chain, deployer: deployer} )
        
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
        const { airlineFundAmount } = getTestParameters()
        whitelistAppContract({ chain, deployer: deployer} )
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
        assertStxTransfer(block.receipts[0].events[0], airlineFundAmount, airline1.address, deployer.address.concat('.', dataContract));
    },    
});


Clarinet.test({
    name: "Ensure that flight can be registered by funded airline",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1 } = getAccounts({accounts})
        const { airlineFundAmount, flightNumber, departure, maxPayout, purchaseAmount } = getTestParameters()
        whitelistAppContract({ chain, deployer: deployer})
        const flightStatus = [10, 20]
        const payout = [105, 110]
        const payoutsTuple = { 
            status: types.list([uint(flightStatus[0]), uint(flightStatus[1])]),
            payout: types.list([uint(payout[0]), uint(payout[1])])
        }
        let block = chain.mineBlock([
            fundAirlineTx(airline1),
            registerFlightTx(airline1, flightNumber, payoutsTuple, maxPayout, true )
        ]);
        // check if block with tx is mined
        assertEquals(block.receipts.length, 2);
        // check if tx result was successful
        let tuple = block.receipts[1].result.expectOk().expectTuple();
        tuple['result'].expectBool(true);
        tuple['message'].expectAscii("Flight registered");
        tuple['flight-id'].expectUint(1);
        // check if flight is listed in mapping
        let read = getFlight(chain, 1, flightNumber, deployer)
        tuple = read.result.expectSome().expectTuple();
        tuple.active.expectBool(true)
        tuple['flight-id'].expectUint(1)
        tuple['max-payout'].expectUint(maxPayout)
        let list = tuple.payout.expectList()
        list[0].expectUint(payout[0])
        list[1].expectUint(payout[1])
        list = tuple['status-code'].expectList()
        list[0].expectUint(flightStatus[0])
        list[1].expectUint(flightStatus[1])
    },    
});

Clarinet.test({
    name: "Ensure that surety can be purchgased on registered flight",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1, customer1 } = getAccounts({accounts})
        whitelistAppContract({ chain, deployer: deployer} )
        const { flightNumber, departure, maxPayout, purchaseAmount } = getTestParameters()
        const flightStatus = [10, 20]
        const payout = [105, 110]
        const payoutsTuple = { 
            status: types.list([uint(flightStatus[0]), uint(flightStatus[1])]),
            payout: types.list([uint(payout[0]), uint(payout[1])])
        }
        const expectedPayout = [purchaseAmount * payout[0]/100,purchaseAmount * payout[1]/100]
        let block = chain.mineBlock([
            fundAirlineTx(airline1),
            registerFlightTx(airline1, flightNumber, payoutsTuple, maxPayout, true ),
            purchaseSuretyTx( 1, departure, purchaseAmount, customer1)
        ]);
        // check if block with tx is mined
        assertEquals(block.receipts.length, 3);
        // check if tx was successful
        let tuple = block.receipts[2].result.expectOk().expectTuple();
        tuple.result.expectBool(true)
        tuple.message.expectAscii("Surety purchased")
        // check if surety is listed in mapping  
        let read = getSurety(chain, customer1, 1);
        tuple = read.result.expectSome().expectTuple();
        tuple.departure.expectInt(departure)
        tuple = tuple.payouts.expectTuple()
        let list = tuple.amount.expectList()
        list[0].expectUint(expectedPayout[0])
        list[1].expectUint(expectedPayout[1])
        list = tuple.code.expectList()
        list[0].expectUint(flightStatus[0])
        list[1].expectUint(flightStatus[1])
    },    
});

Clarinet.test({ //// test unsuccesful upddate assert
    name: "Ensure that flight status can be updated by airline",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1, customer1 } = getAccounts({accounts})
        whitelistAppContract({ chain, deployer: deployer} )
        const { flightNumber, departure, maxPayout, purchaseAmount } = getTestParameters()
        const flightStatus = [10, 20]
        const payout = [105, 110]
        const payoutsTuple = { 
            status: types.list([uint(flightStatus[0]), uint(flightStatus[1])]),
            payout: types.list([uint(payout[0]), uint(payout[1])])
        }
        const expectedPayout = [purchaseAmount * payout[0]/100,purchaseAmount * payout[1]/100]
        let block = chain.mineBlock([
            fundAirlineTx(airline1),
            registerFlightTx(airline1, flightNumber, payoutsTuple, maxPayout, true ),
            purchaseSuretyTx( 1, departure, purchaseAmount, customer1),
            updateFlightTx(1, departure, flightStatus[1], airline1)
        ]);
        // check if block with tx is mined
        assertEquals(block.receipts.length, 4);
        // check if stx transfer was successful
        let tuple = block.receipts[3].result.expectOk().expectTuple();
        tuple['result'].expectBool(true);
        tuple['message'].expectAscii("Flight status updated");
        tuple['flight-id'].expectUint(1);
        tuple['status'].expectUint(flightStatus[1]);
    },    
});

const suretyPayoutTx = (flightId: number, sender: Account) =>
    Tx.contractCall(appContract, "surety-payout", [uint(flightId)],  sender.address );

Clarinet.test({ //// test unsuccesful upddate assert
    name: "Ensure that surety payout is successfull",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1, customer1 } = getAccounts({accounts})
        whitelistAppContract({ chain, deployer: deployer} )
        const { flightNumber, departure, maxPayout, purchaseAmount } = getTestParameters()
        const flightStatus = [10, 20]
        const payout = [105, 110]
        const payoutsTuple = { 
            status: types.list([uint(flightStatus[0]), uint(flightStatus[1])]),
            payout: types.list([uint(payout[0]), uint(payout[1])])
        }
        const expectedPayout = [purchaseAmount * payout[0]/100,purchaseAmount * payout[1]/100]
        let block = chain.mineBlock([
            fundAirlineTx(airline1),
            registerFlightTx(airline1, flightNumber, payoutsTuple, maxPayout, true ),
            purchaseSuretyTx( 1, departure, purchaseAmount, customer1),
            updateFlightTx(1, departure, flightStatus[1], airline1),
            suretyPayoutTx(1, customer1)
        ]);
        // check if block with tx is mined
        assertEquals(block.receipts.length, 5);
        // check result tuple
        let tuple = block.receipts[4].result.expectOk().expectTuple();
        tuple['result'].expectBool(true);
        tuple['message'].expectAscii("Surety has been paid to insuree");
        tuple['flight-status'].expectUint(flightStatus[1]);
        // check if stx transfer was successful
        assertStxTransfer(block.receipts[4].events[0], expectedPayout[1], deployer.address.concat('.', dataContract), customer1.address,);
        // check if surety is not longer listed in mapping  
        let read = getSurety(chain, customer1, 1);
        read.result.expectNone()
    },    
});
