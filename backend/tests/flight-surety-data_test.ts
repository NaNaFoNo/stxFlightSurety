
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.31.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

const { uint, principal, bool, ascii, some } = types;

const dataContract = 'flight-surety-data';
const appContract = 'flight-surety-app';
const AIRLINE_FUNDING = 1000000;

// amount max 4
function registerAirlines({ chain, amount, accounts }: { chain: Chain, amount: number, accounts: Map<string, Account>}) {
    const airlines = ['airline_1', 'airline_2', 'airline_3', 'airline_4', 'airline_5', 'airline_6']
    let deployer = accounts.get("deployer")!;
    let airline1 = accounts.get(airlines[0])!;

    const whitlistBlock = chain.mineBlock([
        whitelistPrincipalTx(deployer, deployer),
    ]);   

    let registerBlock: any, i: number
    for(i = 1;amount >= i;i++) {
        registerBlock = chain.mineBlock([
            applicationAirlineTx(accounts.get(airlines[i])!, `Airline ${i}` , airline1, deployer.address),
            registerAirlineTx(accounts.get(airlines[i])!, deployer.address)
        ]);
        registerBlock.receipts[0].result.expectOk().expectTuple();
        registerBlock.receipts[1].result.expectOk().expectBool(true);
    }
    return { registerBlock, deployer, airlines};
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
    name: "Check if whitelisting App-Contract is working",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get("deployer")!;
        // check not whitelisted
        let check = readIsWhitelisted(chain, deployer);
        check.result.expectBool(false);
        // contract call to whitelist appContract
        let block = chain.mineBlock([
            whitelistPrincipalTx(deployer, deployer),
        ]);
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
        const [deployer, airline1] = ['deployer', 'airline_1'].map(name => accounts.get(name)!);
        let block = chain.mineBlock([
            whitelistPrincipalTx(deployer, airline1),
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 2);
        block.receipts[0].result.expectErr().expectUint(1001);
        
        let check = readIsWhitelisted(chain, deployer);
        check.result.expectBool(false);
    },
});

// airlines
// check if arirline is registered on deployment
Clarinet.test({
    name: "Check airline registered on deployment 'get-airline'",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const [deployer, airline1] = ['deployer', 'airline_1'].map(name => accounts.get(name)!);

        assertEquals(chain.blockHeight, 1);

        let readState = hasAirlineState(chain, airline1, deployer, 2)
        let results = getAirline(chain, airline1, deployer)
        readState.result.expectBool(true);

        let resultTuple = results.result.expectSome().expectTuple()
        resultTuple['airline-id'].expectUint(1)
        resultTuple['airline-name'].expectAscii("First Airline")
        resultTuple['airline-state'].expectUint(2)
        resultTuple['voters'].expectList()
    },
});

// airline to application
Clarinet.test({
    name: "Check registered airline can add new airline application (private register-airline-init)",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const [deployer, airline1, airline2] = ['deployer', 'airline_1', 'airline_2'].map(name => accounts.get(name)!);

        let block = chain.mineBlock([
            whitelistPrincipalTx(deployer, deployer),
            applicationAirlineTx(airline2, "Name" , airline1, deployer.address)
        ]);
        assertEquals(block.receipts.length, 2);
        assertEquals(block.height, 2);
        
        const result = block.receipts[1].result.expectOk().expectTuple()
        assertEquals(result, {'airline-state': uint(1), votes: uint(1)})
    },
});

Clarinet.test({
    name: "Check application-airline asserts! are working",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { registerBlock, deployer, airlines } = registerAirlines({ chain, amount: 1, accounts });
        const [airline1, airline2, airline3, airline4, airline5, airline6] = airlines.map(name => accounts.get(name)!);
        const chainHeight = registerBlock.height

        let block = chain.mineBlock([
            applicationAirlineTx(airline3, "Airline 3" , airline2, airline1.address),  // not whitelisted
            applicationAirlineTx(airline3, "Airline 3" , airline3, deployer.address),  // ONLY_BY_REGISTERED_AIRLINE
            applicationAirlineTx(airline1, "Airline 1" , airline2, deployer.address),  // AIRLINE_ALREADY_REGISTERED
        ]);
        assertEquals(block.receipts.length, 3);
        assertEquals(block.height, chainHeight + 1);

        block.receipts[0].result.expectErr().expectUint(1002)  // not whitelisted
        block.receipts[1].result.expectErr().expectUint(2004)  // ONLY_BY_REGISTERED_AIRLINE
        block.receipts[2].result.expectErr().expectUint(2003)  // AIRLINE_ALREADY_REGISTERED
    },
});

Clarinet.test({
    name: "Check double vote rejected",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const [deployer, airline1, airline2] = ['deployer', 'airline_1', 'airline_2'].map(name => accounts.get(name)!);
       
        let block = chain.mineBlock([
            whitelistPrincipalTx(deployer, deployer),
            applicationAirlineTx(airline2, "" , airline1, deployer.address),
            applicationAirlineTx(airline2, "" , airline1, deployer.address)
        ]);
        assertEquals(block.receipts.length, 3);
        assertEquals(block.height, 2);
        block.receipts[2].result.expectErr().expectUint(2007)
    },
});

// airline register 

Clarinet.test({
    name: "Check register-airline",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { registerBlock, deployer, airlines } = registerAirlines({ chain, amount: 4, accounts });
        const regAirlinesCount = chain.callReadOnlyFn(dataContract, "get-airlines-count", [], deployer.address);

        registerBlock.receipts[1].result.expectOk().expectBool(true);
        regAirlinesCount.result.expectUint(5)
    },
});

Clarinet.test({
    name: "Check votes counting up",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { registerBlock, deployer, airlines } = registerAirlines({ chain, amount: 4, accounts });
        const [airline1, airline2, airline3, airline4, airline5, airline6] = airlines.map(name => accounts.get(name)!);
        const chainHeight = registerBlock.height
        let block = chain.mineBlock([
            applicationAirlineTx(airline6, "" , airline2, deployer.address),
            applicationAirlineTx(airline6, "" , airline3, deployer.address),
            applicationAirlineTx(airline6, "" , airline4, deployer.address),
            applicationAirlineTx(airline6, "" , airline5, deployer.address),
        ]);
        assertEquals(block.receipts.length, 4);
        assertEquals(block.height, chainHeight + 1);
        const result = block.receipts[3].result.expectOk().expectTuple()
        assertEquals(result, {'airline-state': uint(1), votes: uint(4)})
    },
});


// airline funding

Clarinet.test({
    name: "Check fund-airline",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        //const [deployer, airline1, airline2] = ['deployer', 'airline_1', 'airline_2'].map(name => accounts.get(name)!);
        const { registerBlock, deployer, airlines } = registerAirlines({ chain, amount: 0, accounts });
        let airline1 = accounts.get(airlines[0])!;

        let block = chain.mineBlock([
            fundAirlineTx(airline1)
        ]);

        console.log(block.receipts[0].events);
        block.receipts[0].events.expectSTXTransferEvent(
            AIRLINE_FUNDING,
            airline1.address,
            deployer.address.concat('.', dataContract),
        );

        //let block = chain.mineBlock([
        //    applicationAirlineTx(airline2, "Second airline" , airline2, airline1.address)
        //]);
        //assertEquals(block.receipts.length, 1);
        //assertEquals(block.height, 2);
        
        //block.receipts[0].result.expectErr().expectUint(1001);
        //
        //let check = readIsWhitelisted(chain, deployer);
        //check.result.expectBool(false);
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