/*
Compression II: LZ Decompression
You are attempting to solve a Coding Contract. You have 10 tries remaining, after which the contract will self-destruct.


Lempel-Ziv (LZ) compression is a data compression technique which encodes data using references to earlier parts of the data. In this variant of LZ, data is encoded in two types of chunk. Each chunk begins with a length L, encoded as a single ASCII digit from 1 to 9, followed by the chunk data, which is either:

1. Exactly L characters, which are to be copied directly into the uncompressed data.
2. A reference to an earlier part of the uncompressed data. To do this, the length is followed by a second ASCII digit X: each of the L output characters is a copy of the character X places before it in the uncompressed data.

For both chunk types, a length of 0 instead means the chunk ends immediately, and the next character is the start of a new chunk. The two chunk types alternate, starting with type 1, and the final chunk may be of either type.

You are given the following LZ-encoded string:
    9qQXdzNemp462zi756pylykd382U3748muZH6YyY265uE2lw940760749UMQ5dxBOY0388536
Decode it and output the original string.

Example: decoding '5aaabb450723abb' chunk-by-chunk
    5aaabb           ->  aaabb
    5aaabb45         ->  aaabbaaab
    5aaabb450        ->  aaabbaaab
    5aaabb45072      ->  aaabbaaababababa
    5aaabb450723abb  ->  aaabbaaababababaabb
*/

/** @param {NS} ns */
export async function main(ns) {
  let current_index = 0
  let input = "9qQXdzNemp462zi756pylykd382U3748muZH6YyY265uE2lw940760749UMQ5dxBOY0388536"
  // input = "5aaabb450723abb"
  let result = ""


  function decode_chunk_type1(input, current_index) {
    let L = parseInt(input[current_index++])
    if (L == 0) return current_index // end of chunk
    let end_index = current_index + L
    ns.tprint("chunk type 1, L == " + L + " : current_index == " + current_index + " : end_index == " + end_index)
    for (let i = current_index;i < end_index;i++) {
      result += input[i]
    }
    ns.tprint("chunk type 1, result == " + result + " : end_index == " + end_index)
    return end_index
  }

  function decode_chunk_type2(input, current_index) {
    let L = parseInt(input[current_index++])
    if (L == 0) return current_index // end of chunk
    let X = parseInt(input[current_index++])
    let end_index = current_index
    ns.tprint("chunk type 2, L == " + L + " : X == " + X + " : current_index == " + current_index + " : end_index == " + end_index + " : result == " + result)

    for (let i = 0;i < L;i++) {
      result += result[result.length-X]
    }
    
    ns.tprint("chunk type 2, result == " + result + " : end_index == " + end_index)
    return end_index
  }

  while (current_index < input.length) {
    current_index = decode_chunk_type1(input, current_index)
    current_index = decode_chunk_type2(input, current_index)
  }
}
