
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.31.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

const { uint, principal, bool, ascii, tuple, int } = types;

const dataContract = 'flight-surety-data';
const AIRLINE_FUNDING = 1000000;

/// *** Helper functions for unit tests *** ///
// get Accounts
function getAccounts ({accounts}: {accounts: Map<string, Account>}){
    const wallets = [ 'deployer', 'airline_1', 'airline_2', 'airline_3', 'airline_4', 'airline_5', 'airline_6']
    const [deployer, airline1, airline2, airline3, airline4, airline5, airline6] = wallets.map(name => accounts.get(name)!);

    return { deployer, airline1, airline2, airline3, airline4, airline5, airline6 };
}

// whitelist a principal to call functions
function whitelistDeployer ({chain, deployer, whitelist}: {chain: Chain, deployer: Account, whitelist: Account}) {
    const height = chain.blockHeight
    const block = chain.mineBlock([
        whitelistPrincipalTx(whitelist, deployer),
    ]);
    // check if block with tx is mined
    assertEquals(block.receipts.length, 1);
    assertEquals(block.height, height + 1);
    // check if whitelist tx was successfull
    block.receipts[0].result.expectOk().expectBool(true);
    // check read-only "is-whitelisted" equals true
    let check = readIsWhitelisted(chain, deployer);
    check.result.expectBool(true);

    return { whitelistBlock: block, whitelistedCaller: whitelist};
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

// read-only functions
const readIsWhitelisted = (chain: Chain, deployer: Account) =>
    chain.callReadOnlyFn(dataContract, "is-whitelisted", [principal(deployer.address),], deployer.address);  // principal(deployer.address.concat('.', appContract))

const getAirline = (chain: Chain, airline: Account, sender: Account) =>
    chain.callReadOnlyFn(dataContract, "get-airline", [principal(airline.address)], sender.address);

const getAirlinesCount = (chain: Chain, sender: Account) =>
    chain.callReadOnlyFn(dataContract, "get-airlines-count", [], sender.address);

const getFlight = (chain: Chain, airlineId: number, flightId: string ,sender: Account) =>
    chain.callReadOnlyFn(dataContract, "get-flight", [uint(airlineId), ascii(flightId)], sender.address);

const getSurety = (chain: Chain, insuree: Account, airlineId: number, flightId: string ,sender: Account) =>
    chain.callReadOnlyFn(dataContract, "get-surety", [principal(insuree.address), uint(airlineId), ascii(flightId)], sender.address);

const lastBlockTime = (chain: Chain, sender: Account) =>
    chain.callReadOnlyFn(dataContract, "get-last-block-time", [], sender.address);

// public functions
const whitelistPrincipalTx = (deployer: Account, sender: Account) => 
    Tx.contractCall(dataContract,'set-whitelisted',[principal(deployer.address), bool(true)], sender.address);

const addAirlineTx = (airline: Account, airlineName: string , caller: Account, status: number, whitelistedCaller: Account) =>
    Tx.contractCall(dataContract, "add-airline-data", [principal(airline.address), ascii(airlineName), principal(caller.address), uint(status)], whitelistedCaller.address );

const fundAirlineTx = (airline: Account, deployer: Account, amount: number) =>
    Tx.contractCall(dataContract, "funded-airline-state", [principal(airline.address), uint(amount)], deployer.address);

const addFlightTx = (airlineId: number, flightId: string , activate: boolean, payouts: any, maxPayout: number, whitelistedCaller: Account) =>
    Tx.contractCall(dataContract, "register-flight", [uint(airlineId), ascii(flightId), bool(activate), tuple(payouts), uint(maxPayout)], whitelistedCaller.address );

const purchaseSuretyTx = (airlineId: number, flightId: string , departure: number, amount: number, insuree: Account) =>
    Tx.contractCall(dataContract, "purchase-surety", [principal(insuree.address), uint(airlineId), ascii(flightId), int(departure), uint(amount)], insuree.address );

const suretyPayoutTx = (insuree: Account, airlineId: number, flightId: string , status: number ) =>
    Tx.contractCall(dataContract, "surety-payout", [principal(insuree.address), uint(airlineId), ascii(flightId), uint(status)], insuree.address );


// *** unit tests *** //
// whitelist app contract
Clarinet.test({
    name: "Check if whitelisting is working",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer } = getAccounts({accounts})
        // check not whitelisted
        let check = readIsWhitelisted(chain, deployer);
        check.result.expectBool(false);
        // contract call to whitelist appContract
        let block = chain.mineBlock([
            whitelistPrincipalTx(deployer, deployer),
        ]);
        // check successful block with correct result
        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 2);
        block.receipts[0].result.expectOk().expectBool(true);
        // check whitelisted equals true
        check = readIsWhitelisted(chain, deployer);
        check.result.expectBool(true);
    },
});

Clarinet.test({
    name: "Check if whitelisting doesn't work for other principals than contract owner",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1 } = getAccounts({accounts})
        let block = chain.mineBlock([
            whitelistPrincipalTx(deployer, airline1),
        ]);
        // check if block is mined with err result
        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 2);
        block.receipts[0].result.expectErr().expectUint(2011);
        // check whitelisted equals false
        let check = readIsWhitelisted(chain, deployer);
        check.result.expectBool(false);
    },
});

// airlines
// check if arirline is registered on deployment
Clarinet.test({
    name: "Check airline registered on deployment, read-only-functions working properly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1 } = getAccounts({accounts})

        assertEquals(chain.blockHeight, 1);

        let result1 = getAirlinesCount(chain, deployer);
        result1.result.expectUint(1);
        // call read-only functions
        let result2 = getAirline(chain, airline1, deployer)        
        // check airline Data has been submitted
        let airlineData = result2.result.expectSome().expectTuple()
        airlineData['airline-id'].expectUint(1)
        airlineData['airline-name'].expectAscii("First Airline")
        airlineData['airline-state'].expectUint(2)
        airlineData['voters'].expectList()
    },
});

// add airline data  (checks: new airline (id+ state vote), update airline (id data-update vote+/state+), )
Clarinet.test({
    name: "Check if new airline can be added, and data vars and maps are filled properly", 
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1, airline2, airline3, airline4 } = getAccounts({accounts})
        const { whitelistedCaller } = whitelistDeployer({ chain, deployer: deployer, whitelist: deployer} )
        const airlineName = "Airline 2"

        const block = chain.mineBlock([
            addAirlineTx(airline2, airlineName, airline1, 2, whitelistedCaller),  // add airline with status "Registered"
        ]);
        // check proper function results
        let tuple = block.receipts[0].result.expectOk().expectTuple()
        tuple['airline-id'].expectUint(2)
        tuple['airline-state'].expectUint(2)
        tuple['reg-airlines'].expectUint(2)
        tuple['votes'].expectUint(1)
        // check registeredAirlines data-var
        let result1 = getAirlinesCount(chain, deployer);
        result1.result.expectUint(2);
        // check Airlines map data
        let result2 = getAirline(chain, airline2, deployer)        
        let airlineData = result2.result.expectSome().expectTuple()
        airlineData['airline-id'].expectUint(2)
        airlineData['airline-name'].expectAscii(airlineName)
        airlineData['airline-state'].expectUint(2)
        let voters = airlineData['voters'].expectList()
        voters[0].expectPrincipal(airline1.address)
    },
});

Clarinet.test({
    name: "Check if new airlines can be added, and idCounter is working", 
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1, airline2, airline3, airline4 } = getAccounts({accounts})
        const { whitelistedCaller } = whitelistDeployer({ chain, deployer: deployer, whitelist: deployer} )

        const block = chain.mineBlock([
            addAirlineTx(airline2, "Airline 2", airline1, 1, whitelistedCaller),  // add airline2 with status "Application"
            addAirlineTx(airline3, "Airline 3", airline1, 1, whitelistedCaller),  // add airline3 with status "Application"
            addAirlineTx(airline4, "Airline 4", airline1, 1, whitelistedCaller),  // add airline4 with status "Application"
        ]);

        // check tx results
        for (let i = 0; i < 3; i++) {
            let tuple = block.receipts[i].result.expectOk().expectTuple()
            tuple['airline-id'].expectUint(i + 2)  // receipts[0] expected id = u2
        }
    },
});

Clarinet.test({
    name: "Check if new airlines can be added, and registeredAirlines Counter is working", 
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1, airline2, airline3, airline4 } = getAccounts({accounts})
        const { whitelistedCaller } = whitelistDeployer({ chain, deployer: deployer, whitelist: deployer} )

        const block = chain.mineBlock([
            addAirlineTx(airline2, "Airline 2", airline1, 2, whitelistedCaller),  // add airline2 with status "Registered"
            addAirlineTx(airline3, "Airline 3", airline1, 2, whitelistedCaller),  // add airline3 with status "Registered"
            addAirlineTx(airline4, "Airline 4", airline1, 2, whitelistedCaller),  // add airline4 with status "Registered"
        ]);

        // check tx results
        for (let i = 0; i < 3; i++) {
            let tuple = block.receipts[i].result.expectOk().expectTuple()
            tuple['reg-airlines'].expectUint(i + 2)  // receipts[0] expected u2
        }
    },
});

Clarinet.test({
    name: "Check if voting on airlines and voters list is working properly", 
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1, airline2, airline3, airline4 } = getAccounts({accounts})
        const { whitelistedCaller } = whitelistDeployer({ chain, deployer: deployer, whitelist: deployer} )

        const block = chain.mineBlock([
            addAirlineTx(airline2, "Airline 2", airline1, 1, whitelistedCaller),  // add airline2 with status "Application"
            addAirlineTx(airline2, "Airline 2", airline3, 1, whitelistedCaller),  // update airline2 votes +1
            addAirlineTx(airline2, "Airline 2", airline4, 1, whitelistedCaller),  // update airline2 votes +1
        ]);

        // check tx results
        for (let i = 0; i < 3; i++) {
            let tuple = block.receipts[i].result.expectOk().expectTuple()
            tuple['votes'].expectUint(i + 1)  // receipts[0] expected votes u1
        }
    },
});

Clarinet.test({
    name: "Check if asserts prevent adding/updating airline by not whitelisted caller", 
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1, airline2 } = getAccounts({accounts})
        const { whitelistedCaller } = whitelistDeployer({ chain, deployer: deployer, whitelist: deployer} )

        const block = chain.mineBlock([
            addAirlineTx(airline2, "Airline 2", airline1, 1, airline2),  // adding airline2 with not whitelisted caller
            addAirlineTx(airline1, "Airline 1", airline1, 1, airline2),  // updating airline1 with not whitelisted caller
        ]);
        
        block.receipts[0].result.expectErr().expectUint(2012)
        block.receipts[1].result.expectErr().expectUint(2012)   
    },
});

// airline funding

Clarinet.test({
    name: "Check funded-airline-state",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1 } = getAccounts({accounts})
        const { whitelistBlock, whitelistedCaller } = whitelistDeployer({ chain, deployer: deployer, whitelist: deployer} )
        const amount = 1000000;
        const block = chain.mineBlock([
            fundAirlineTx(airline1, whitelistedCaller, amount),
            Tx.transferSTX(amount, deployer.address.concat('.', dataContract), airline1.address),
        ]);
        // check if block with tx is mined
        assertEquals(block.receipts.length, 2);
        assertEquals(block.height, whitelistBlock.height + 1);
        // check if tx was successful
        block.receipts[0].result.expectOk().expectBool(true);
        // check airline state has changed to u3 "Funded" 
        let result = getAirline(chain, airline1, deployer)        
        let airlineData = result.result.expectSome().expectTuple()
        airlineData['airline-state'].expectUint(3) 
    },
});

// adding flights

Clarinet.test({
    name: "Check if flight can be registered",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1 } = getAccounts({accounts})
        const { whitelistBlock, whitelistedCaller } = whitelistDeployer({ chain, deployer: deployer, whitelist: deployer} )
        const payoutsTuple = { 
            status: types.list([uint(10), uint(20), uint(30)]),
            payout: types.list([uint(105), uint(110), uint(115)])
        }
        const amount = 1000000;
        const block = chain.mineBlock([
            fundAirlineTx(airline1, whitelistedCaller, amount),
            Tx.transferSTX(amount, deployer.address.concat('.', dataContract), airline1.address),
            addFlightTx(1, "SK1234", true, payoutsTuple, 10000, whitelistedCaller)
        ]);
        // check if block with tx is mined
        assertEquals(block.receipts.length, 3);
        
        // check if tx was successful
        block.receipts[2].result.expectOk().expectBool(true);
        // check if flight is listed in mapping  
        let read = getFlight(chain, 1, "SK1234", whitelistedCaller);
        read.result.expectSome()
    },
});

// Surety purchase and payout

Clarinet.test({
    name: "Check surety can be purchased",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1 } = getAccounts({accounts})
        const { whitelistBlock, whitelistedCaller } = whitelistDeployer({ chain, deployer: deployer, whitelist: deployer} )
        const payoutsTuple = { 
            status: types.list([uint(1), uint(2)]),
            payout: types.list([uint(105), uint(110)])
        }
        const amount = 1000000;
        const block = chain.mineBlock([
            fundAirlineTx(airline1, whitelistedCaller, amount),
            Tx.transferSTX(amount, deployer.address.concat('.', dataContract), airline1.address),
            addFlightTx(1, "SK1234", true, payoutsTuple, 10000, whitelistedCaller),
            purchaseSuretyTx(1, "SK1234", 123452435, 8000, whitelistedCaller)
        ]);
        // check if block with tx is mined
        assertEquals(block.receipts.length, 4);
        
        // check if tx was successful
        block.receipts[3].result.expectOk().expectBool(true);
        // check if flight is listed in mapping  
        let read = getSurety(chain, deployer, 1, "SK1234", whitelistedCaller);
        read.result.expectSome()
    },
});

Clarinet.test({
    name: "Check surety payout successfull ",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1 } = getAccounts({accounts})
        const { whitelistBlock, whitelistedCaller } = whitelistDeployer({ chain, deployer: deployer, whitelist: deployer} )
        const payoutsTuple = { 
            status: types.list([uint(1), uint(2)]),
            payout: types.list([uint(105), uint(110)])
        }
        const amount = 1000000;
        const block = chain.mineBlock([
            fundAirlineTx(airline1, whitelistedCaller, amount),
            Tx.transferSTX(amount, deployer.address.concat('.', dataContract), airline1.address),
            addFlightTx(1, "SK1234", true, payoutsTuple, 10000, whitelistedCaller),
            purchaseSuretyTx(1, "SK1234", 123452435, 8000, whitelistedCaller),
            suretyPayoutTx(deployer, 1, "SK1234", 2)
        ]);
        // check if block with tx is mined
        assertEquals(block.receipts.length, 5);
        // check if stx transfer was successful
        block.receipts[4].result.expectOk().expectBool(true);
        assertStxTransfer(block.receipts[4].events[0], 8800, deployer.address.concat('.', dataContract), deployer.address,);
        // check if surety is not longer listed in mapping  
        let read = getSurety(chain, deployer, 1, "SK1234", whitelistedCaller);
        read.result.expectNone()
    },
});


