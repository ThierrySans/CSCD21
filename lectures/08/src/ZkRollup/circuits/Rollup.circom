pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";
include "./MerkleTree.circom";

template Rollup(levels, max_users, max_transactions) {
    
    // Transactions
    signal input from[max_transactions];
    signal input to[max_transactions];
    signal input amount[max_transactions];
    
    // Balances
    signal input balances[max_users];

    // Merkle Trees
    signal input oldRoot;
    signal input oldTreeSiblings[levels];
    signal input oldTreePathIndices[levels];
    
    signal input newRoot;
    signal input newTreeSiblings[levels];
    signal input newTreePathIndices[levels];

    // Intermediate
    signal fromInter[max_transactions*max_users];
    signal toInter[max_transactions*max_users];
    
    // Components
    component isEqualFrom[max_transactions*max_users];
    component isEqualTo[max_transactions*max_users];
    component isGreaterEqThan[max_transactions*max_users];
    component oldBalanceHasher[max_users];
    component oldTree[max_users];
    component isEqualOld[max_transactions];
    component newBalanceHasher[max_users];
    component newTree[max_users];
    component isEqualNew[max_transactions];
    
    for (var u = 0; u < max_users; u++) {        
        oldBalanceHasher[u] = Poseidon(2);
        oldBalanceHasher[u].inputs <== [u, balances[u]];
        
        oldTree[u] = MerkleTreeInclusionProof(levels);
        oldTree[u].leaf <== oldBalanceHasher[u].out;
        for (var k = 0; k < levels; k++) {
            oldTree[u].siblings[k] <== oldTreeSiblings[k];
            oldTree[u].pathIndices[k] <== oldTreePathIndices[k];
        }
        
        isEqualOld[u] = IsEqual();
        isEqualOld[u].in <== [oldTree[u].root, oldRoot];
        1 === isEqualOld[u].out;
        
        var balance = balances[u];
        
        for (var t = 0; t < max_transactions; t++) {
            var k = t * max_users + u;
            
            isEqualFrom[k] = IsEqual();
            isEqualFrom[k].in <== [from[t], u];
            
            fromInter[k] <== isEqualFrom[k].out * amount[t];
            
            isGreaterEqThan[k] = GreaterEqThan(32);
            isGreaterEqThan[k].in <== [balance, fromInter[k]];
            1 === isGreaterEqThan[k].out;
            
            balance -= fromInter[k];
            
            isEqualTo[k] = IsEqual();
            isEqualTo[k].in <== [to[t], u];
            toInter[k] <== isEqualTo[k].out * amount[t];
            balance += toInter[k];
        }
        
        newBalanceHasher[u] = Poseidon(2);
        newBalanceHasher[u].inputs <== [u, balances[u]];
        
        newTree[u] = MerkleTreeInclusionProof(levels);
        newTree[u].leaf <== newBalanceHasher[u].out;
        for (var k = 0; k < levels; k++) {
            newTree[u].siblings[k] <== newTreeSiblings[k];
            newTree[u].pathIndices[k] <== newTreePathIndices[k];
        }
        
        isEqualNew[u] = IsEqual();
        isEqualNew[u].in <== [newTree[u].root, newRoot];
        1 === isEqualNew[u].out;
    }
}

component main {public [from, to, amount, oldRoot, newRoot]} = Rollup(5, 32, 100);
