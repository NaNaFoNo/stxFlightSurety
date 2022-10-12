
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

const registeredAirlineCount = (chain: Chain, deployer: Account) =>
    chain.callReadOnlyFn(appContract, "registered-airline-count", [], deployer.address);  // principal(deployer.address.concat('.', appContract))

const hasAirlineState = (chain: Chain, deployer: Account, airline: Account, minState: number) =>
    chain.callReadOnlyFn(appContract, "has-airline-state", [principal(airline.address), uint(minState)], deployer.address);  // principal(deployer.address.concat('.', appContract))

const getAirline = (chain: Chain, airline: Account, deployer: Account) =>
    chain.callReadOnlyFn(appContract, "get-airline", [principal(airline.address)], deployer.address);

const hasDataAccess = (chain: Chain, deployer: Account) =>
    chain.callReadOnlyFn(appContract, "has-data-access", [], deployer.address);  // principal(deployer.address.concat('.', appContract))
    
const whitelistAppContractTx = (deployer: Account) =>
    Tx.contractCall(appContract, "whitelist-app-contract", [], deployer.address);  // principal(deployer.address.concat('.', appContract))

const addAirlineTx = (airline: Account, airlineName: string , caller: Account, appSender: string) =>
    Tx.contractCall(appContract, "add-airline", [principal(airline.address), ascii(airlineName), principal(caller.address)], appSender );




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
        block.receipts[0].result.expectErr().expectUint(2011);
        // read whitelisting after tx, expect true
        read = hasDataAccess(chain, deployer)
        read.result.expectBool(false)
    },
});

Clarinet.test({
    name: "Ensure that registered airlines count is received from data-contract (read-only)",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer } = getAccounts({accounts})
        
        let read = registeredAirlineCount(chain, deployer ) 
        read.result.expectUint(1)
    },    
});

Clarinet.test({
    name: "Ensure that has-airline-state is received correctly from data-contract (read-only)",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1 } = getAccounts({accounts})
        
        let read = hasAirlineState(chain, deployer, airline1, 2) // 2 for registered state
        read.result.expectBool(true)
        read = hasAirlineState(chain, deployer, airline1, 3) // 2 for registered state
        read.result.expectBool(false)
        read = hasAirlineState(chain, deployer, deployer, 0) // 0 for init or not in map
        read.result.expectBool(true)  
    }, 
});

Clarinet.test({
    name: "Ensure that get-airline data is received succesful from data-contract (read-only)",
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
    name: "WHITELIST FCT",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1, airline2, airline3, airline4, airline5, airline6 } = getAccounts({accounts})
        const { whitelistBlock } = whitelistAppContract({ chain, deployer: deployer} )
        
        
        let block = chain.mineBlock([
            addAirlineTx(airline2, "Airline 2", airline1, deployer.address ),
            addAirlineTx(airline3, "Airline 3", airline1, deployer.address ),
            addAirlineTx(airline4, "Airline 4", airline1, deployer.address ),
            addAirlineTx(airline4, "Airline 4", airline1, deployer.address ),
            addAirlineTx(airline4, "Airline 4", airline2, deployer.address ),
        ]);
        console.log(block)
    },    

});