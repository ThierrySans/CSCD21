pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";
include "./MerkleTree.circom";

template Update(levels) {

    // user inputs
    signal input user;
    signal input oldBalance;
    signal input newBalance;
    
    // Merkle Trees
    signal input oldRoot;
    signal input oldTreeSiblings[levels];
    signal input oldTreePathIndices[levels];
    
    signal input newRoot;
    signal input newTreeSiblings[levels];
    signal input newTreePathIndices[levels];
    
    component oldBalanceHasher = Poseidon(2);
    oldBalanceHasher.inputs <== [user, oldBalance];
    
    component oldTree = MerkleTreeInclusionProof(levels);
    oldTree.leaf <== oldBalanceHasher.out;
    for (var k = 0; k < levels; k++) {
        oldTree.siblings[k] <== oldTreeSiblings[k];
        oldTree.pathIndices[k] <== oldTreePathIndices[k];
    }
    
    component isEqualOld = IsEqual();
    isEqualOld.in <== [oldTree.root, oldRoot];
    1 === isEqualOld.out;
    
    component newBalanceHasher = Poseidon(2);
    newBalanceHasher.inputs <== [user, newBalance];
    
    component newTree = MerkleTreeInclusionProof(levels);
    newTree.leaf <== newBalanceHasher.out;
    for (var k = 0; k < levels; k++) {
        newTree.siblings[k] <== newTreeSiblings[k];
        newTree.pathIndices[k] <== newTreePathIndices[k];
    }
    
    component isEqualNew = IsEqual();
    isEqualNew.in <== [newTree.root, newRoot];
    1 === isEqualNew.out;    
}

component main {public [user, oldBalance, newBalance, oldRoot, newRoot]} = Update(5);
