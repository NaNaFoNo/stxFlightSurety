
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.31.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

const { uint, principal, bool, ascii, some } = types;

const dataContract = 'flight-surety-data';
const appContract = 'flight-surety-app';
const airlines = [ 'airline_1', 'airline_2', 'airline_3', 'airline_4', 'airline_5', 'airline_6']
const AIRLINE_FUNDING = 1000000;

function getAccounts ({accounts}: {accounts: Map<string, Account>}){
    const wallets = [ 'deployer', 'airline_1', 'airline_2', 'airline_3', 'airline_4', 'airline_5', 'airline_6']
    const [deployer, airline1, airline2, airline3, airline4, airline5, airline6] = wallets.map(name => accounts.get(name)!);

    return { deployer, airline1, airline2, airline3, airline4, airline5, airline6 };
}

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
// const { whitelistBlock, whitelistedCaller } = whitelistCaller({ chain, Principal, Principal })

// amount max 4
function registerAirlines({ chain, amount, accounts, caller }: { chain: Chain, amount: number, accounts: Map<string, Account>, caller: Account}) {
    const addAirlines = ['airline_1', 'airline_2', 'airline_3', 'airline_4', 'airline_5', 'airline_6']
    let deployer = accounts.get("deployer")!;
    let airline1 = accounts.get(airlines[0])!;

    // const whitlistBlock = chain.mineBlock([
    //     whitelistPrincipalTx(deployer, deployer),
    // ]);   

    let block: any, i: number
    for(i = 1;amount >= i;i++) {
        block = chain.mineBlock([
            applicationAirlineTx(accounts.get(addAirlines[i])!, `Airline ${i}` , airline1, caller.address),
            registerAirlineTx(accounts.get(addAirlines[i])!, caller.address)
        ]);
        block.receipts[0].result.expectOk().expectTuple();
        block.receipts[1].result.expectOk().expectBool(true);
    }
    return { registerBlock: block, deployer, addAirlines};
}

// read-only functions
const readIsWhitelisted = (chain: Chain, deployer: Account) =>
    chain.callReadOnlyFn(dataContract, "is-whitelisted", [principal(deployer.address),], deployer.address);  // principal(deployer.address.concat('.', appContract))

const hasAirlineState = (chain: Chain, airline: Account, sender: Account, state: number) =>
    chain.callReadOnlyFn(dataContract, "has-airline-state", [principal(airline.address),uint(state)], sender.address);

const getAirline = (chain: Chain, airline: Account, sender: Account) =>
    chain.callReadOnlyFn(dataContract, "get-airline", [principal(airline.address)], sender.address);

// public functions
const whitelistPrincipalTx = (deployer: Account, sender: Account) => 
    Tx.contractCall(dataContract,'set-whitelisted',[principal(deployer.address), bool(true)], sender.address);

const applicationAirlineTx = (airline: Account, airlineName: string , caller: Account, appSender: string) =>
    Tx.contractCall(dataContract, "application-airline", [principal(airline.address), some(ascii(airlineName)), principal(caller.address)], appSender );

const registerAirlineTx = (airline: Account, caller: string) =>
    Tx.contractCall(dataContract, "register-airline", [principal(airline.address)], caller);

const fundAirlineTx = (airline: Account) =>
    Tx.contractCall(dataContract, "fund-airline", [principal(airline.address)], airline.address);


// *** unit tests *** //
// whitelist app contract
Clarinet.test({
    name: "Check if whitelisting of a principal is working",
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
    name: "Check if whitelisting doesn't work for not contract owner principals",
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
    name: "Check airline registered on deployment 'get-airline'",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1 } = getAccounts({accounts})

        assertEquals(chain.blockHeight, 1);
        // call read-only functions
        let readState = hasAirlineState(chain, airline1, deployer, 2)
        let results = getAirline(chain, airline1, deployer)
        // check if airline is registered
        readState.result.expectBool(true);
        // check airline Data has been submitted
        let airlineData = results.result.expectSome().expectTuple()
        airlineData['airline-id'].expectUint(1)
        airlineData['airline-name'].expectAscii("First Airline")
        airlineData['airline-state'].expectUint(2)
        airlineData['voters'].expectList()
    },
});

// airline to application
Clarinet.test({
    name: "Check registered airline can add new airline application (private register-airline-init)",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1, airline2} = getAccounts({accounts})
        const { whitelistBlock, whitelistedCaller } = whitelistDeployer({ chain, deployer: deployer, whitelist: deployer} )

        let block = chain.mineBlock([
            applicationAirlineTx(airline2, "Name" , airline1, whitelistedCaller.address)
        ]);
        // block is mined succesful and tx receipt is available
        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, whitelistBlock.height +1);
        // checl if result is as expected
        const result = block.receipts[0].result.expectOk().expectTuple()
        assertEquals(result, {'airline-state': uint(1), votes: uint(1)})
    },
});

Clarinet.test({
    name: "Check application-airline asserts! are working",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1, airline2, airline3 } = getAccounts({accounts})
        const { whitelistedCaller } = whitelistDeployer({ chain, deployer: deployer, whitelist: deployer} )
        const { registerBlock } = registerAirlines({ chain, amount: 1, accounts, caller: whitelistedCaller });
        
        let block = chain.mineBlock([
            applicationAirlineTx(airline3, "Airline 3" , airline2, airline1.address),  // not whitelisted
            applicationAirlineTx(airline3, "Airline 3" , airline3, deployer.address),  // ONLY_BY_REGISTERED_AIRLINE
            applicationAirlineTx(airline1, "Airline 1" , airline2, deployer.address),  // AIRLINE_ALREADY_REGISTERED
        ]);
        // block is mined succesful and tx receipts are available
        assertEquals(block.receipts.length, 3);
        assertEquals(block.height, registerBlock.height + 1);
        // check if correct err messages are shown
        block.receipts[0].result.expectErr().expectUint(2012)  // not whitelisted
        block.receipts[1].result.expectErr().expectUint(2004)  // ONLY_BY_REGISTERED_AIRLINE
        block.receipts[2].result.expectErr().expectUint(2003)  // AIRLINE_ALREADY_REGISTERED
    },
});

Clarinet.test({
    name: "Check double vote rejected",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1, airline2 } = getAccounts({accounts})
        const { whitelistBlock, whitelistedCaller } = whitelistDeployer({ chain, deployer: deployer, whitelist: deployer} )
        
        let block = chain.mineBlock([
            applicationAirlineTx(airline2, "" , airline1, whitelistedCaller.address),
            applicationAirlineTx(airline2, "" , airline1, whitelistedCaller.address)
        ]);
        // block is mined succesful and tx receipts are available
        assertEquals(block.receipts.length, 2);
        assertEquals(block.height, whitelistBlock.height +1);
        // check first succesful vote on airline init
        const result = block.receipts[0].result.expectOk().expectTuple()
        assertEquals(result, {'airline-state': uint(1), votes: uint(1)})
        // check second unsuccesful vote with same voter
        block.receipts[1].result.expectErr().expectUint(2007)
    },
});

// airline register 

Clarinet.test({
    name: "Check get-airlines-count, registered Airlines",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer } = getAccounts({accounts})
        const { whitelistedCaller } = whitelistDeployer({ chain, deployer: deployer, whitelist: deployer} )
        const { registerBlock } = registerAirlines({ chain, amount: 4, accounts, caller: whitelistedCaller });
        const regAirlinesCount = chain.callReadOnlyFn(dataContract, "get-airlines-count", [], deployer.address);
    
        // check if read-only functions returns correct airlines count
        regAirlinesCount.result.expectUint(5)
    },
});

Clarinet.test({
    name: "Check votes counting up",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline2, airline3, airline4, airline5, airline6 } = getAccounts({accounts})
        const { whitelistedCaller } = whitelistDeployer({ chain, deployer: deployer, whitelist: deployer} )
        const { registerBlock } = registerAirlines({ chain, amount: 4, accounts, caller: whitelistedCaller });
        
        let block = chain.mineBlock([
            applicationAirlineTx(airline6, "" , airline2, deployer.address),
            applicationAirlineTx(airline6, "" , airline3, deployer.address),
            applicationAirlineTx(airline6, "" , airline4, deployer.address),
            applicationAirlineTx(airline6, "" , airline5, deployer.address),
        ]);
        assertEquals(block.receipts.length, 4);
        assertEquals(block.height, registerBlock.height + 1);
        const result = block.receipts[3].result.expectOk().expectTuple()
        assertEquals(result, {'airline-state': uint(1), votes: uint(4)})
    },
});


// airline funding

Clarinet.test({
    name: "Check fund-airline",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1 } = getAccounts({accounts})
      
        const block = chain.mineBlock([
            fundAirlineTx(airline1)
        ]);
        // check if block with tx is mined
        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 2);
        // check if tx was successful
        block.receipts[0].result.expectOk().expectBool(true);
        // check if contract got funds from airline
        block.receipts[0].events.expectSTXTransferEvent(
            AIRLINE_FUNDING,
            airline1.address,
            deployer.address.concat('.', dataContract),
        );

    },
});



//Clarinet.test({
//    name: "Check fund-airline",
//    async fn(chain: Chain, accounts: Map<string, Account>) {
//        let deployer = accounts.get("deployer")!;
//        let airline1 = accounts.get("airline_1")!;
//        let airline2 = accounts.get("airline_2")!;
//        let appCaller =  deployer.address.concat('.', appContract)
//
//        let block = chain.mineBlock([
//            applicationAirlineTx(airline2, "Name" , airline1, airline1.address),
//            registerAirlineTx(airline2, airline1.address),
//            fundAirlineTx(airline2, airline2.address),
//        ]);
//        //assertEquals(block.receipts.length, 3);
//        //assertEquals(block.height, 2);
//        // console.log("fund::::", block)
//        // console.log(block.receipts[0].events)
//        // console.log(chain.getAssetsMaps())
//        //block.receipts[0].result.expectErr().expectUint(1001);
//        //
//        //let check = readIsWhitelisted(chain, deployer);
//        //check.result.expectBool(false);
//    },
//});