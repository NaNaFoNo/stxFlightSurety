
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

const registeredAirlineCount = (chain: Chain, deployer: Account) =>
    chain.callReadOnlyFn(appContract, "registered-airline-count", [], deployer.address);  // principal(deployer.address.concat('.', appContract))

const hasAirlineState = (chain: Chain, deployer: Account, airline: Account, minState: number) =>
    chain.callReadOnlyFn(appContract, "has-airline-state", [principal(airline.address), uint(minState)], deployer.address);  // principal(deployer.address.concat('.', appContract))


const hasDataAccess = (chain: Chain, deployer: Account) =>
    chain.callReadOnlyFn(appContract, "has-data-access", [], deployer.address);  // principal(deployer.address.concat('.', appContract))
    

const whitelistAppContract = (deployer: Account) =>
    Tx.contractCall(appContract, "whitelist-app-contract", [], deployer.address);  // principal(deployer.address.concat('.', appContract))

    

Clarinet.test({
    name: "Ensure that airline is registered on deployment and readable from app-contract",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, airline1 } = getAccounts({accounts})
        let read = registeredAirlineCount(chain, deployer ) 
        read.result.expectUint(1)
        read = hasAirlineState(chain, deployer, airline1, 2) // 2 for registered state
        read.result.expectBool(true)
        read = hasDataAccess(chain, deployer)
        
        let block = chain.mineBlock([
            whitelistAppContract(deployer),
        ]);
        //console.log(block)
        read = hasDataAccess(chain, deployer)
       
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
            whitelistAppContract(deployer),
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
            whitelistAppContract(airline1),
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