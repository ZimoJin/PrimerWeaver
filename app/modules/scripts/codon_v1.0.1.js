// PrimerWeaver codon usage database v1.1 (Kazusa-style fractions per amino acid)

export const CODON_USAGE = {
  // Saccharomyces cerevisiae S288C (nuclear, Standard code)
  s_cerevisiae: {
    name: "Saccharomyces cerevisiae S288C",
    code: "s_cerevisiae",
    geneticCode: 1,
    aaTable: {
      // Phe
      F: {
        codons: [
          { codon: "TTT", fraction: 0.59, isPreferred: true },
          { codon: "TTC", fraction: 0.41 }
        ],
        degenerate: "TTY"
      },
      // Ser
      S: {
        codons: [
          { codon: "TCT", fraction: 0.26, isPreferred: true },
          { codon: "TCA", fraction: 0.21 },
          { codon: "TCC", fraction: 0.16 },
          { codon: "AGT", fraction: 0.16 },
          { codon: "AGC", fraction: 0.11 },
          { codon: "TCG", fraction: 0.10 }
        ],
        degenerate: "WSN" // or TCN+AGY; adjust display as needed
      },
      // Tyr
      Y: {
        codons: [
          { codon: "TAT", fraction: 0.56, isPreferred: true },
          { codon: "TAC", fraction: 0.44 }
        ],
        degenerate: "TAY"
      },
      // Cys
      C: {
        codons: [
          { codon: "TGT", fraction: 0.63, isPreferred: true },
          { codon: "TGC", fraction: 0.37 }
        ],
        degenerate: "TGY"
      },
      // Trp
      W: {
        codons: [
          { codon: "TGG", fraction: 1.0, isPreferred: true }
        ],
        degenerate: "TGG"
      },
      // Stop
      STOP: {
        codons: [
          { codon: "TAA", fraction: 0.47, isPreferred: true },
          { codon: "TGA", fraction: 0.30 },
          { codon: "TAG", fraction: 0.23 }
        ],
        degenerate: "TRR"
      },
      // Leu
      L: {
        codons: [
          { codon: "TTG", fraction: 0.29, isPreferred: true },
          { codon: "TTA", fraction: 0.28 },
          { codon: "CTA", fraction: 0.14 },
          { codon: "CTT", fraction: 0.13 },
          { codon: "CTG", fraction: 0.11 },
          { codon: "CTC", fraction: 0.06 }
        ],
        degenerate: "YTN"
      },
      // Pro
      P: {
        codons: [
          { codon: "CCA", fraction: 0.42, isPreferred: true },
          { codon: "CCT", fraction: 0.31 },
          { codon: "CCC", fraction: 0.15 },
          { codon: "CCG", fraction: 0.12 }
        ],
        degenerate: "CCN"
      },
      // His
      H: {
        codons: [
          { codon: "CAT", fraction: 0.64, isPreferred: true },
          { codon: "CAC", fraction: 0.36 }
        ],
        degenerate: "CAY"
      },
      // Gln
      Q: {
        codons: [
          { codon: "CAA", fraction: 0.69, isPreferred: true },
          { codon: "CAG", fraction: 0.31 }
        ],
        degenerate: "CAR"
      },
      // Arg
      R: {
        codons: [
          { codon: "AGA", fraction: 0.48, isPreferred: true },
          { codon: "AGG", fraction: 0.21 },
          { codon: "CGT", fraction: 0.14 },
          { codon: "CGA", fraction: 0.07 },
          { codon: "CGC", fraction: 0.06 },
          { codon: "CGG", fraction: 0.04 }
        ],
        degenerate: "MGN" // or CGN+AGR
      },
      // Ile
      I: {
        codons: [
          { codon: "ATT", fraction: 0.46, isPreferred: true },
          { codon: "ATA", fraction: 0.27 },
          { codon: "ATC", fraction: 0.26 }
        ],
        degenerate: "ATH"
      },
      // Thr
      T: {
        codons: [
          { codon: "ACT", fraction: 0.35, isPreferred: true },
          { codon: "ACA", fraction: 0.30 },
          { codon: "ACC", fraction: 0.22 },
          { codon: "ACG", fraction: 0.14 }
        ],
        degenerate: "ACN"
      },
      // Asn
      N: {
        codons: [
          { codon: "AAT", fraction: 0.59, isPreferred: true },
          { codon: "AAC", fraction: 0.41 }
        ],
        degenerate: "AAY"
      },
      // Lys
      K: {
        codons: [
          { codon: "AAA", fraction: 0.58, isPreferred: true },
          { codon: "AAG", fraction: 0.42 }
        ],
        degenerate: "AAR"
      },
      // Met
      M: {
        codons: [
          { codon: "ATG", fraction: 1.0, isPreferred: true }
        ],
        degenerate: "ATG"
      },
      // Val
      V: {
        codons: [
          { codon: "GTT", fraction: 0.39, isPreferred: true },
          { codon: "GTC", fraction: 0.21 },
          { codon: "GTA", fraction: 0.21 },
          { codon: "GTG", fraction: 0.19 }
        ],
        degenerate: "GTN"
      },
      // Ala
      A: {
        codons: [
          { codon: "GCT", fraction: 0.38, isPreferred: true },
          { codon: "GCA", fraction: 0.29 },
          { codon: "GCC", fraction: 0.22 },
          { codon: "GCG", fraction: 0.11 }
        ],
        degenerate: "GCN"
      },
      // Asp
      D: {
        codons: [
          { codon: "GAT", fraction: 0.65, isPreferred: true },
          { codon: "GAC", fraction: 0.35 }
        ],
        degenerate: "GAY"
      },
      // Glu
      E: {
        codons: [
          { codon: "GAA", fraction: 0.70, isPreferred: true },
          { codon: "GAG", fraction: 0.30 }
        ],
        degenerate: "GAR"
      },
      // Gly
      G: {
        codons: [
          { codon: "GGT", fraction: 0.47, isPreferred: true },
          { codon: "GGA", fraction: 0.22 },
          { codon: "GGC", fraction: 0.19 },
          { codon: "GGG", fraction: 0.12 }
        ],
        degenerate: "GGN"
      }
    }
  },

  // Bacteria
e_coli_k12: {
  name: "Escherichia coli K-12",
  code: "e_coli_k12",
  geneticCode: 11,
  aaTable: {
    // Phe
    F: {
      codons: [
        { codon: "TTT", fraction: 0.57, isPreferred: true },
        { codon: "TTC", fraction: 0.43 }
      ],
      degenerate: "TTY"
    },
    // Ser
    S: {
      codons: [
        { codon: "AGC", fraction: 0.33, isPreferred: true },
        { codon: "TCG", fraction: 0.16 },
        { codon: "TCA", fraction: 0.15 },
        { codon: "AGT", fraction: 0.14 },
        { codon: "TCT", fraction: 0.11 },
        { codon: "TCC", fraction: 0.11 }
      ],
      degenerate: "TCN/AGY"
    },
    // Tyr
    Y: {
      codons: [
        { codon: "TAT", fraction: 0.53, isPreferred: true },
        { codon: "TAC", fraction: 0.47 }
      ],
      degenerate: "TAY"
    },
    // Cys
    C: {
      codons: [
        { codon: "TGC", fraction: 0.58, isPreferred: true },
        { codon: "TGT", fraction: 0.42 }
      ],
      degenerate: "TGY"
    },
    // Trp
    W: {
      codons: [
        { codon: "TGG", fraction: 1.00, isPreferred: true }
      ],
      degenerate: "TGG"
    },
    // Stop
    STOP: {
      codons: [
        { codon: "TAA", fraction: 0.64, isPreferred: true },
        { codon: "TGA", fraction: 0.36 },
        { codon: "TAG", fraction: 0.00 }
      ],
      degenerate: "TRR"
    },
    // Leu
    L: {
      codons: [
        { codon: "CTG", fraction: 0.46, isPreferred: true },
        { codon: "TTA", fraction: 0.15 },
        { codon: "TTG", fraction: 0.12 },
        { codon: "CTT", fraction: 0.12 },
        { codon: "CTC", fraction: 0.10 },
        { codon: "CTA", fraction: 0.05 }
      ],
      degenerate: "YTN"
    },
    // Pro
    P: {
      codons: [
        { codon: "CCG", fraction: 0.55, isPreferred: true },
        { codon: "CCT", fraction: 0.17 },
        { codon: "CCA", fraction: 0.14 },
        { codon: "CCC", fraction: 0.13 }
      ],
      degenerate: "CCN"
    },
    // His
    H: {
      codons: [
        { codon: "CAT", fraction: 0.55, isPreferred: true },
        { codon: "CAC", fraction: 0.45 }
      ],
      degenerate: "CAY"
    },
    // Gln
    Q: {
      codons: [
        { codon: "CAG", fraction: 0.70, isPreferred: true },
        { codon: "CAA", fraction: 0.30 }
      ],
      degenerate: "CAR"
    },
    // Arg
    R: {
      codons: [
        { codon: "CGC", fraction: 0.44, isPreferred: true },
        { codon: "CGT", fraction: 0.36 },
        { codon: "CGA", fraction: 0.07 },
        { codon: "CGG", fraction: 0.07 },
        { codon: "AGG", fraction: 0.03 },
        { codon: "AGA", fraction: 0.02 }
      ],
      degenerate: "CGN/AGR"
    },
    // Ile
    I: {
      codons: [
        { codon: "ATT", fraction: 0.58, isPreferred: true },
        { codon: "ATC", fraction: 0.35 },
        { codon: "ATA", fraction: 0.07 }
      ],
      degenerate: "ATH"
    },
    // Thr
    T: {
      codons: [
        { codon: "ACC", fraction: 0.47, isPreferred: true },
        { codon: "ACG", fraction: 0.24 },
        { codon: "ACT", fraction: 0.16 },
        { codon: "ACA", fraction: 0.13 }
      ],
      degenerate: "ACN"
    },
    // Asn
    N: {
      codons: [
        { codon: "AAC", fraction: 0.53, isPreferred: true },
        { codon: "AAT", fraction: 0.47 }
      ],
      degenerate: "AAY"
    },
    // Lys
    K: {
      codons: [
        { codon: "AAA", fraction: 0.73, isPreferred: true },
        { codon: "AAG", fraction: 0.27 }
      ],
      degenerate: "AAR"
    },
    // Met
    M: {
      codons: [
        { codon: "ATG", fraction: 1.00, isPreferred: true }
      ],
      degenerate: "ATG"
    },
    // Val
    V: {
      codons: [
        { codon: "GTG", fraction: 0.40, isPreferred: true },
        { codon: "GTT", fraction: 0.25 },
        { codon: "GTC", fraction: 0.18 },
        { codon: "GTA", fraction: 0.17 }
      ],
      degenerate: "GTN"
    },
    // Ala
    A: {
      codons: [
        { codon: "GCG", fraction: 0.38, isPreferred: true },
        { codon: "GCC", fraction: 0.31 },
        { codon: "GCA", fraction: 0.21 },
        { codon: "GCT", fraction: 0.11 }
      ],
      degenerate: "GCN"
    },
    // Asp
    D: {
      codons: [
        { codon: "GAT", fraction: 0.65, isPreferred: true },
        { codon: "GAC", fraction: 0.35 }
      ],
      degenerate: "GAY"
    },
    // Glu
    E: {
      codons: [
        { codon: "GAA", fraction: 0.70, isPreferred: true },
        { codon: "GAG", fraction: 0.30 }
      ],
      degenerate: "GAR"
    },
    // Gly
    G: {
      codons: [
        { codon: "GGC", fraction: 0.46, isPreferred: true },
        { codon: "GGT", fraction: 0.29 },
        { codon: "GGA", fraction: 0.13 },
        { codon: "GGG", fraction: 0.12 }
      ],
      degenerate: "GGN"
    }
  }
},

b_subtilis: {
  name: "Bacillus subtilis",
  code: "b_subtilis",
  geneticCode: 11,
  aaTable: {

    // Phe
    F: {
      codons: [
        { codon: "TTT", fraction: 0.63, isPreferred: true },
        { codon: "TTC", fraction: 0.37 }
      ],
      degenerate: "TTY"
    },

    // Ser
    S: {
      codons: [
        { codon: "TCT", fraction: 0.30, isPreferred: true },
        { codon: "TCC", fraction: 0.22 },
        { codon: "TCA", fraction: 0.17 },
        { codon: "AGT", fraction: 0.15 },
        { codon: "AGC", fraction: 0.10 },
        { codon: "TCG", fraction: 0.06 }
      ],
      degenerate: "TCN/AGY"
    },

    // Tyr
    Y: {
      codons: [
        { codon: "TAT", fraction: 0.65, isPreferred: true },
        { codon: "TAC", fraction: 0.35 }
      ],
      degenerate: "TAY"
    },

    // Cys
    C: {
      codons: [
        { codon: "TGT", fraction: 0.67, isPreferred: true },
        { codon: "TGC", fraction: 0.33 }
      ],
      degenerate: "TGY"
    },

    // Trp
    W: {
      codons: [
        { codon: "TGG", fraction: 1.00, isPreferred: true }
      ],
      degenerate: "TGG"
    },

    // STOP
    STOP: {
      codons: [
        { codon: "TAA", fraction: 0.58, isPreferred: true },
        { codon: "TAG", fraction: 0.29 },
        { codon: "TGA", fraction: 0.13 }
      ],
      degenerate: "TRR"
    },

    // Leu
    L: {
      codons: [
        { codon: "CTT", fraction: 0.30, isPreferred: true },
        { codon: "TTA", fraction: 0.21 },
        { codon: "CTG", fraction: 0.16 },
        { codon: "CTC", fraction: 0.12 },
        { codon: "TTG", fraction: 0.12 },
        { codon: "CTA", fraction: 0.09 }
      ],
      degenerate: "YTN"
    },

    // Pro
    P: {
      codons: [
        { codon: "CCT", fraction: 0.38, isPreferred: true },
        { codon: "CCA", fraction: 0.32 },
        { codon: "CCC", fraction: 0.17 },
        { codon: "CCG", fraction: 0.13 }
      ],
      degenerate: "CCN"
    },

    // His
    H: {
      codons: [
        { codon: "CAT", fraction: 0.57, isPreferred: true },
        { codon: "CAC", fraction: 0.43 }
      ],
      degenerate: "CAY"
    },

    // Gln
    Q: {
      codons: [
        { codon: "CAA", fraction: 0.59, isPreferred: true },
        { codon: "CAG", fraction: 0.41 }
      ],
      degenerate: "CAR"
    },

    // Arg
    R: {
      codons: [
        { codon: "CGT", fraction: 0.37, isPreferred: true },
        { codon: "CGA", fraction: 0.20 },
        { codon: "CGC", fraction: 0.19 },
        { codon: "CGG", fraction: 0.14 },
        { codon: "AGA", fraction: 0.06 },
        { codon: "AGG", fraction: 0.04 }
      ],
      degenerate: "CGN/AGR"
    },

    // Ile
    I: {
      codons: [
        { codon: "ATT", fraction: 0.53, isPreferred: true },
        { codon: "ATC", fraction: 0.29 },
        { codon: "ATA", fraction: 0.18 }
      ],
      degenerate: "ATH"
    },

    // Thr
    T: {
      codons: [
        { codon: "ACT", fraction: 0.37, isPreferred: true },
        { codon: "ACC", fraction: 0.30 },
        { codon: "ACA", fraction: 0.21 },
        { codon: "ACG", fraction: 0.12 }
      ],
      degenerate: "ACN"
    },

    // Asn
    N: {
      codons: [
        { codon: "AAT", fraction: 0.61, isPreferred: true },
        { codon: "AAC", fraction: 0.39 }
      ],
      degenerate: "AAY"
    },

    // Lys
    K: {
      codons: [
        { codon: "AAA", fraction: 0.74, isPreferred: true },
        { codon: "AAG", fraction: 0.26 }
      ],
      degenerate: "AAR"
    },

    // Met
    M: {
      codons: [
        { codon: "ATG", fraction: 1.00, isPreferred: true }
      ],
      degenerate: "ATG"
    },

    // Val
    V: {
      codons: [
        { codon: "GTT", fraction: 0.34, isPreferred: true },
        { codon: "GTC", fraction: 0.27 },
        { codon: "GTA", fraction: 0.22 },
        { codon: "GTG", fraction: 0.17 }
      ],
      degenerate: "GTN"
    },

    // Ala
    A: {
      codons: [
        { codon: "GCT", fraction: 0.43, isPreferred: true },
        { codon: "GCC", fraction: 0.25 },
        { codon: "GCA", fraction: 0.20 },
        { codon: "GCG", fraction: 0.12 }
      ],
      degenerate: "GCN"
    },

    // Asp
    D: {
      codons: [
        { codon: "GAT", fraction: 0.69, isPreferred: true },
        { codon: "GAC", fraction: 0.31 }
      ],
      degenerate: "GAY"
    },

    // Glu
    E: {
      codons: [
        { codon: "GAA", fraction: 0.69, isPreferred: true },
        { codon: "GAG", fraction: 0.31 }
      ],
      degenerate: "GAR"
    },

    // Gly
    G: {
      codons: [
        { codon: "GGT", fraction: 0.36, isPreferred: true },
        { codon: "GGC", fraction: 0.28 },
        { codon: "GGA", fraction: 0.20 },
        { codon: "GGG", fraction: 0.16 }
      ],
      degenerate: "GGN"
    }
  }
},

c_glutamicum: {
  name: "Corynebacterium glutamicum",
  code: "c_glutamicum",
  geneticCode: 11,
  aaTable: {

    // Phe
    F: {
      codons: [
        { codon: "TTT", fraction: 0.63, isPreferred: true },
        { codon: "TTC", fraction: 0.37 }
      ],
      degenerate: "TTY"
    },

    // Ser
    S: {
      codons: [
        { codon: "TCT", fraction: 0.29, isPreferred: true },
        { codon: "TCC", fraction: 0.22 },
        { codon: "TCA", fraction: 0.17 },
        { codon: "AGC", fraction: 0.14 },
        { codon: "AGT", fraction: 0.12 },
        { codon: "TCG", fraction: 0.06 }
      ],
      degenerate: "TCN/AGY"
    },

    // Tyr
    Y: {
      codons: [
        { codon: "TAT", fraction: 0.67, isPreferred: true },
        { codon: "TAC", fraction: 0.33 }
      ],
      degenerate: "TAY"
    },

    // Cys
    C: {
      codons: [
        { codon: "TGT", fraction: 0.73, isPreferred: true },
        { codon: "TGC", fraction: 0.27 }
      ],
      degenerate: "TGY"
    },

    // Trp
    W: {
      codons: [
        { codon: "TGG", fraction: 1.0, isPreferred: true }
      ],
      degenerate: "TGG"
    },

    // STOP
    STOP: {
      codons: [
        { codon: "TGA", fraction: 0.46, isPreferred: true },
        { codon: "TAA", fraction: 0.43 },
        { codon: "TAG", fraction: 0.11 }
      ],
      degenerate: "TRR"
    },

    // Leu
    L: {
      codons: [
        { codon: "CTG", fraction: 0.32, isPreferred: true },
        { codon: "TTA", fraction: 0.24 },
        { codon: "CTT", fraction: 0.18 },
        { codon: "TTG", fraction: 0.15 },
        { codon: "CTA", fraction: 0.06 },
        { codon: "CTC", fraction: 0.05 }
      ],
      degenerate: "YTN"
    },

    // Pro
    P: {
      codons: [
        { codon: "CCA", fraction: 0.37, isPreferred: true },
        { codon: "CCT", fraction: 0.28 },
        { codon: "CCC", fraction: 0.20 },
        { codon: "CCG", fraction: 0.15 }
      ],
      degenerate: "CCN"
    },

    // His
    H: {
      codons: [
        { codon: "CAT", fraction: 0.59, isPreferred: true },
        { codon: "CAC", fraction: 0.41 }
      ],
      degenerate: "CAY"
    },

    // Gln
    Q: {
      codons: [
        { codon: "CAA", fraction: 0.61, isPreferred: true },
        { codon: "CAG", fraction: 0.39 }
      ],
      degenerate: "CAR"
    },

    // Arg
    R: {
      codons: [
        { codon: "CGT", fraction: 0.34, isPreferred: true },
        { codon: "CGC", fraction: 0.25 },
        { codon: "CGA", fraction: 0.18 },
        { codon: "CGG", fraction: 0.11 },
        { codon: "AGA", fraction: 0.07 },
        { codon: "AGG", fraction: 0.05 }
      ],
      degenerate: "CGN/AGR"
    },

    // Ile
    I: {
      codons: [
        { codon: "ATT", fraction: 0.51, isPreferred: true },
        { codon: "ATC", fraction: 0.32 },
        { codon: "ATA", fraction: 0.17 }
      ],
      degenerate: "ATH"
    },

    // Thr
    T: {
      codons: [
        { codon: "ACA", fraction: 0.35, isPreferred: true },
        { codon: "ACT", fraction: 0.29 },
        { codon: "ACC", fraction: 0.22 },
        { codon: "ACG", fraction: 0.14 }
      ],
      degenerate: "ACN"
    },

    // Asn
    N: {
      codons: [
        { codon: "AAT", fraction: 0.63, isPreferred: true },
        { codon: "AAC", fraction: 0.37 }
      ],
      degenerate: "AAY"
    },

    // Lys
    K: {
      codons: [
        { codon: "AAA", fraction: 0.71, isPreferred: true },
        { codon: "AAG", fraction: 0.29 }
      ],
      degenerate: "AAR"
    },

    // Met
    M: {
      codons: [
        { codon: "ATG", fraction: 1.0, isPreferred: true }
      ],
      degenerate: "ATG"
    },

    // Val
    V: {
      codons: [
        { codon: "GTT", fraction: 0.38, isPreferred: true },
        { codon: "GTC", fraction: 0.25 },
        { codon: "GTA", fraction: 0.20 },
        { codon: "GTG", fraction: 0.17 }
      ],
      degenerate: "GTN"
    },

    // Ala
    A: {
      codons: [
        { codon: "GCT", fraction: 0.40, isPreferred: true },
        { codon: "GCC", fraction: 0.27 },
        { codon: "GCA", fraction: 0.22 },
        { codon: "GCG", fraction: 0.11 }
      ],
      degenerate: "GCN"
    },

    // Asp
    D: {
      codons: [
        { codon: "GAT", fraction: 0.69, isPreferred: true },
        { codon: "GAC", fraction: 0.31 }
      ],
      degenerate: "GAY"
    },

    // Glu
    E: {
      codons: [
        { codon: "GAA", fraction: 0.68, isPreferred: true },
        { codon: "GAG", fraction: 0.32 }
      ],
      degenerate: "GAR"
    },

    // Gly
    G: {
      codons: [
        { codon: "GGT", fraction: 0.36, isPreferred: true },
        { codon: "GGC", fraction: 0.27 },
        { codon: "GGA", fraction: 0.19 },
        { codon: "GGG", fraction: 0.18 }
      ],
      degenerate: "GGN"
    }
  }
},


  // Yeasts & fungi
p_pastoris: {
  name: "Pichia pastoris (Komagataella phaffii)",
  code: "p_pastoris",
  geneticCode: 1,
  aaTable: {

    // Phe
    F: {
      codons: [
        { codon: "TTT", fraction: 0.61, isPreferred: true },
        { codon: "TTC", fraction: 0.39 }
      ],
      degenerate: "TTY"
    },

    // Ser
    S: {
      codons: [
        { codon: "TCT", fraction: 0.27, isPreferred: true },
        { codon: "TCA", fraction: 0.22 },
        { codon: "TCC", fraction: 0.17 },
        { codon: "AGT", fraction: 0.16 },
        { codon: "AGC", fraction: 0.10 },
        { codon: "TCG", fraction: 0.08 }
      ],
      degenerate: "TCN/AGY"
    },

    // Tyr
    Y: {
      codons: [
        { codon: "TAT", fraction: 0.55, isPreferred: true },
        { codon: "TAC", fraction: 0.45 }
      ],
      degenerate: "TAY"
    },

    // Cys
    C: {
      codons: [
        { codon: "TGT", fraction: 0.63, isPreferred: true },
        { codon: "TGC", fraction: 0.37 }
      ],
      degenerate: "TGY"
    },

    // Trp
    W: {
      codons: [
        { codon: "TGG", fraction: 1.00, isPreferred: true }
      ],
      degenerate: "TGG"
    },

    // STOP
    STOP: {
      codons: [
        { codon: "TAA", fraction: 0.49, isPreferred: true },
        { codon: "TGA", fraction: 0.31 },
        { codon: "TAG", fraction: 0.20 }
      ],
      degenerate: "TRR"
    },

    // Leu
    L: {
      codons: [
        { codon: "TTA", fraction: 0.31, isPreferred: true },
        { codon: "TTG", fraction: 0.27 },
        { codon: "CTA", fraction: 0.17 },
        { codon: "CTT", fraction: 0.13 },
        { codon: "CTG", fraction: 0.07 },
        { codon: "CTC", fraction: 0.05 }
      ],
      degenerate: "YTN"
    },

    // Pro
    P: {
      codons: [
        { codon: "CCA", fraction: 0.41, isPreferred: true },
        { codon: "CCT", fraction: 0.29 },
        { codon: "CCC", fraction: 0.16 },
        { codon: "CCG", fraction: 0.14 }
      ],
      degenerate: "CCN"
    },

    // His
    H: {
      codons: [
        { codon: "CAT", fraction: 0.60, isPreferred: true },
        { codon: "CAC", fraction: 0.40 }
      ],
      degenerate: "CAY"
    },

    // Gln
    Q: {
      codons: [
        { codon: "CAA", fraction: 0.68, isPreferred: true },
        { codon: "CAG", fraction: 0.32 }
      ],
      degenerate: "CAR"
    },

    // Arg
    R: {
      codons: [
        { codon: "AGA", fraction: 0.44, isPreferred: true },
        { codon: "AGG", fraction: 0.22 },
        { codon: "CGT", fraction: 0.15 },
        { codon: "CGA", fraction: 0.09 },
        { codon: "CGC", fraction: 0.06 },
        { codon: "CGG", fraction: 0.04 }
      ],
      degenerate: "CGN/AGR"
    },

    // Ile
    I: {
      codons: [
        { codon: "ATT", fraction: 0.45, isPreferred: true },
        { codon: "ATA", fraction: 0.29 },
        { codon: "ATC", fraction: 0.26 }
      ],
      degenerate: "ATH"
    },

    // Thr
    T: {
      codons: [
        { codon: "ACT", fraction: 0.34, isPreferred: true },
        { codon: "ACA", fraction: 0.32 },
        { codon: "ACC", fraction: 0.23 },
        { codon: "ACG", fraction: 0.11 }
      ],
      degenerate: "ACN"
    },

    // Asn
    N: {
      codons: [
        { codon: "AAT", fraction: 0.59, isPreferred: true },
        { codon: "AAC", fraction: 0.41 }
      ],
      degenerate: "AAY"
    },

    // Lys
    K: {
      codons: [
        { codon: "AAA", fraction: 0.55, isPreferred: true },
        { codon: "AAG", fraction: 0.45 }
      ],
      degenerate: "AAR"
    },

    // Met
    M: {
      codons: [
        { codon: "ATG", fraction: 1.00, isPreferred: true }
      ],
      degenerate: "ATG"
    },

    // Val
    V: {
      codons: [
        { codon: "GTT", fraction: 0.38, isPreferred: true },
        { codon: "GTC", fraction: 0.22 },
        { codon: "GTA", fraction: 0.21 },
        { codon: "GTG", fraction: 0.19 }
      ],
      degenerate: "GTN"
    },

    // Ala
    A: {
      codons: [
        { codon: "GCT", fraction: 0.36, isPreferred: true },
        { codon: "GCA", fraction: 0.30 },
        { codon: "GCC", fraction: 0.23 },
        { codon: "GCG", fraction: 0.11 }
      ],
      degenerate: "GCN"
    },

    // Asp
    D: {
      codons: [
        { codon: "GAT", fraction: 0.66, isPreferred: true },
        { codon: "GAC", fraction: 0.34 }
      ],
      degenerate: "GAY"
    },

    // Glu
    E: {
      codons: [
        { codon: "GAA", fraction: 0.71, isPreferred: true },
        { codon: "GAG", fraction: 0.29 }
      ],
      degenerate: "GAR"
    },

    // Gly
    G: {
      codons: [
        { codon: "GGT", fraction: 0.45, isPreferred: true },
        { codon: "GGA", fraction: 0.24 },
        { codon: "GGC", fraction: 0.19 },
        { codon: "GGG", fraction: 0.12 }
      ],
      degenerate: "GGN"
    }
  }
},

y_lipolytica: {
  name: "Yarrowia lipolytica",
  code: "y_lipolytica",
  geneticCode: 1,
  aaTable: {

    // Phe
    F: {
      codons: [
        { codon: "TTT", fraction: 0.63, isPreferred: true },
        { codon: "TTC", fraction: 0.37 }
      ],
      degenerate: "TTY"
    },

    // Ser
    S: {
      codons: [
        { codon: "TCT", fraction: 0.28, isPreferred: true },
        { codon: "TCA", fraction: 0.22 },
        { codon: "TCC", fraction: 0.16 },
        { codon: "AGT", fraction: 0.16 },
        { codon: "AGC", fraction: 0.10 },
        { codon: "TCG", fraction: 0.08 }
      ],
      degenerate: "TCN/AGY"
    },

    // Tyr
    Y: {
      codons: [
        { codon: "TAT", fraction: 0.62, isPreferred: true },
        { codon: "TAC", fraction: 0.38 }
      ],
      degenerate: "TAY"
    },

    // Cys
    C: {
      codons: [
        { codon: "TGT", fraction: 0.71, isPreferred: true },
        { codon: "TGC", fraction: 0.29 }
      ],
      degenerate: "TGY"
    },

    // Trp
    W: {
      codons: [
        { codon: "TGG", fraction: 1.00, isPreferred: true }
      ],
      degenerate: "TGG"
    },

    // STOP
    STOP: {
      codons: [
        { codon: "TAA", fraction: 0.53, isPreferred: true },
        { codon: "TGA", fraction: 0.31 },
        { codon: "TAG", fraction: 0.16 }
      ],
      degenerate: "TRR"
    },

    // Leu
    L: {
      codons: [
        { codon: "TTA", fraction: 0.34, isPreferred: true },
        { codon: "TTG", fraction: 0.27 },
        { codon: "CTA", fraction: 0.14 },
        { codon: "CTT", fraction: 0.12 },
        { codon: "CTC", fraction: 0.07 },
        { codon: "CTG", fraction: 0.06 }
      ],
      degenerate: "YTN"
    },

    // Pro
    P: {
      codons: [
        { codon: "CCA", fraction: 0.39, isPreferred: true },
        { codon: "CCT", fraction: 0.29 },
        { codon: "CCC", fraction: 0.19 },
        { codon: "CCG", fraction: 0.13 }
      ],
      degenerate: "CCN"
    },

    // His
    H: {
      codons: [
        { codon: "CAT", fraction: 0.57, isPreferred: true },
        { codon: "CAC", fraction: 0.43 }
      ],
      degenerate: "CAY"
    },

    // Gln
    Q: {
      codons: [
        { codon: "CAA", fraction: 0.64, isPreferred: true },
        { codon: "CAG", fraction: 0.36 }
      ],
      degenerate: "CAR"
    },

    // Arg
    R: {
      codons: [
        { codon: "AGA", fraction: 0.46, isPreferred: true },
        { codon: "AGG", fraction: 0.20 },
        { codon: "CGT", fraction: 0.15 },
        { codon: "CGA", fraction: 0.09 },
        { codon: "CGC", fraction: 0.06 },
        { codon: "CGG", fraction: 0.04 }
      ],
      degenerate: "CGN/AGR"
    },

    // Ile
    I: {
      codons: [
        { codon: "ATT", fraction: 0.48, isPreferred: true },
        { codon: "ATA", fraction: 0.30 },
        { codon: "ATC", fraction: 0.22 }
      ],
      degenerate: "ATH"
    },

    // Thr
    T: {
      codons: [
        { codon: "ACT", fraction: 0.36, isPreferred: true },
        { codon: "ACA", fraction: 0.32 },
        { codon: "ACC", fraction: 0.22 },
        { codon: "ACG", fraction: 0.10 }
      ],
      degenerate: "ACN"
    },

    // Asn
    N: {
      codons: [
        { codon: "AAT", fraction: 0.60, isPreferred: true },
        { codon: "AAC", fraction: 0.40 }
      ],
      degenerate: "AAY"
    },

    // Lys
    K: {
      codons: [
        { codon: "AAA", fraction: 0.58, isPreferred: true },
        { codon: "AAG", fraction: 0.42 }
      ],
      degenerate: "AAR"
    },

    // Met
    M: {
      codons: [
        { codon: "ATG", fraction: 1.00, isPreferred: true }
      ],
      degenerate: "ATG"
    },

    // Val
    V: {
      codons: [
        { codon: "GTT", fraction: 0.37, isPreferred: true },
        { codon: "GTA", fraction: 0.23 },
        { codon: "GTC", fraction: 0.22 },
        { codon: "GTG", fraction: 0.18 }
      ],
      degenerate: "GTN"
    },

    // Ala
    A: {
      codons: [
        { codon: "GCT", fraction: 0.37, isPreferred: true },
        { codon: "GCA", fraction: 0.30 },
        { codon: "GCC", fraction: 0.22 },
        { codon: "GCG", fraction: 0.11 }
      ],
      degenerate: "GCN"
    },

    // Asp
    D: {
      codons: [
        { codon: "GAT", fraction: 0.68, isPreferred: true },
        { codon: "GAC", fraction: 0.32 }
      ],
      degenerate: "GAY"
    },

    // Glu
    E: {
      codons: [
        { codon: "GAA", fraction: 0.71, isPreferred: true },
        { codon: "GAG", fraction: 0.29 }
      ],
      degenerate: "GAR"
    },

    // Gly
    G: {
      codons: [
        { codon: "GGT", fraction: 0.44, isPreferred: true },
        { codon: "GGA", fraction: 0.24 },
        { codon: "GGC", fraction: 0.19 },
        { codon: "GGG", fraction: 0.13 }
      ],
      degenerate: "GGN"
    }
  }
},


  // Mammals / cell lines
human: {
  name: "Homo sapiens",
  code: "human",
  geneticCode: 1,
  aaTable: {
    // Phe
    F: {
      codons: [
        { codon: "TTC", fraction: 0.54, isPreferred: true },
        { codon: "TTT", fraction: 0.46 }
      ],
      degenerate: "TTY"
    },
    // Ser
    S: {
      codons: [
        { codon: "AGC", fraction: 0.24, isPreferred: true },
        { codon: "TCC", fraction: 0.22 },
        { codon: "TCT", fraction: 0.19 },
        { codon: "TCA", fraction: 0.15 },
        { codon: "AGT", fraction: 0.15 },
        { codon: "TCG", fraction: 0.05 }
      ],
      degenerate: "TCN/AGY"
    },
    // Tyr
    Y: {
      codons: [
        { codon: "TAC", fraction: 0.56, isPreferred: true },
        { codon: "TAT", fraction: 0.44 }
      ],
      degenerate: "TAY"
    },
    // Cys
    C: {
      codons: [
        { codon: "TGC", fraction: 0.54, isPreferred: true },
        { codon: "TGT", fraction: 0.46 }
      ],
      degenerate: "TGY"
    },
    // Trp
    W: {
      codons: [
        { codon: "TGG", fraction: 1.00, isPreferred: true }
      ],
      degenerate: "TGG"
    },
    // Stop
    STOP: {
      codons: [
        { codon: "TGA", fraction: 0.47, isPreferred: true },
        { codon: "TAA", fraction: 0.30 },
        { codon: "TAG", fraction: 0.24 }
      ],
      degenerate: "TRR"
    },
    // Leu
    L: {
      codons: [
        { codon: "CTG", fraction: 0.40, isPreferred: true },
        { codon: "CTC", fraction: 0.20 },
        { codon: "CTT", fraction: 0.13 },
        { codon: "TTG", fraction: 0.13 },
        { codon: "TTA", fraction: 0.08 },
        { codon: "CTA", fraction: 0.07 }
      ],
      degenerate: "YTN"
    },
    // Pro
    P: {
      codons: [
        { codon: "CCC", fraction: 0.32, isPreferred: true },
        { codon: "CCT", fraction: 0.29 },
        { codon: "CCA", fraction: 0.28 },
        { codon: "CCG", fraction: 0.11 }
      ],
      degenerate: "CCN"
    },
    // His
    H: {
      codons: [
        { codon: "CAC", fraction: 0.58, isPreferred: true },
        { codon: "CAT", fraction: 0.42 }
      ],
      degenerate: "CAY"
    },
    // Gln
    Q: {
      codons: [
        { codon: "CAG", fraction: 0.73, isPreferred: true },
        { codon: "CAA", fraction: 0.27 }
      ],
      degenerate: "CAR"
    },
    // Arg
    R: {
      codons: [
        { codon: "AGG", fraction: 0.21, isPreferred: true },
        { codon: "AGA", fraction: 0.21 },
        { codon: "CGG", fraction: 0.20 },
        { codon: "CGC", fraction: 0.18 },
        { codon: "CGA", fraction: 0.11 },
        { codon: "CGT", fraction: 0.08 }
      ],
      degenerate: "CGN/AGR"
    },
    // Ile
    I: {
      codons: [
        { codon: "ATC", fraction: 0.47, isPreferred: true },
        { codon: "ATT", fraction: 0.36 },
        { codon: "ATA", fraction: 0.17 }
      ],
      degenerate: "ATH"
    },
    // Thr
    T: {
      codons: [
        { codon: "ACC", fraction: 0.36, isPreferred: true },
        { codon: "ACA", fraction: 0.28 },
        { codon: "ACT", fraction: 0.25 },
        { codon: "ACG", fraction: 0.11 }
      ],
      degenerate: "ACN"
    },
    // Asn
    N: {
      codons: [
        { codon: "AAC", fraction: 0.53, isPreferred: true },
        { codon: "AAT", fraction: 0.47 }
      ],
      degenerate: "AAY"
    },
    // Lys
    K: {
      codons: [
        { codon: "AAG", fraction: 0.57, isPreferred: true },
        { codon: "AAA", fraction: 0.43 }
      ],
      degenerate: "AAR"
    },
    // Met
    M: {
      codons: [
        { codon: "ATG", fraction: 1.00, isPreferred: true }
      ],
      degenerate: "ATG"
    },
    // Val
    V: {
      codons: [
        { codon: "GTG", fraction: 0.46, isPreferred: true },
        { codon: "GTC", fraction: 0.24 },
        { codon: "GTT", fraction: 0.18 },
        { codon: "GTA", fraction: 0.12 }
      ],
      degenerate: "GTN"
    },
    // Ala
    A: {
      codons: [
        { codon: "GCC", fraction: 0.40, isPreferred: true },
        { codon: "GCT", fraction: 0.27 },
        { codon: "GCA", fraction: 0.23 },
        { codon: "GCG", fraction: 0.11 }
      ],
      degenerate: "GCN"
    },
    // Asp
    D: {
      codons: [
        { codon: "GAC", fraction: 0.54, isPreferred: true },
        { codon: "GAT", fraction: 0.46 }
      ],
      degenerate: "GAY"
    },
    // Glu
    E: {
      codons: [
        { codon: "GAG", fraction: 0.58, isPreferred: true },
        { codon: "GAA", fraction: 0.42 }
      ],
      degenerate: "GAR"
    },
    // Gly
    G: {
      codons: [
        { codon: "GGC", fraction: 0.34, isPreferred: true },
        { codon: "GGA", fraction: 0.25 },
        { codon: "GGG", fraction: 0.25 },
        { codon: "GGT", fraction: 0.16 }
      ],
      degenerate: "GGN"
    }
  }
},

mouse: {
  name: "Mus musculus",
  code: "mouse",
  geneticCode: 1,
  aaTable: {

    // Phe
    F: {
      codons: [
        { codon: "TTC", fraction: 0.56, isPreferred: true },
        { codon: "TTT", fraction: 0.44 },
      ],
      degenerate: "TTY"
    },

    // Ser
    S: {
      codons: [
        { codon: "AGC", fraction: 0.24, isPreferred: true },
        { codon: "TCC", fraction: 0.22 },
        { codon: "TCT", fraction: 0.20 },
        { codon: "AGT", fraction: 0.15 },
        { codon: "TCA", fraction: 0.14 },
        { codon: "TCG", fraction: 0.05 },
      ],
      degenerate: "TCN/AGY"
    },

    // Tyr
    Y: {
      codons: [
        { codon: "TAC", fraction: 0.57, isPreferred: true },
        { codon: "TAT", fraction: 0.43 },
      ],
      degenerate: "TAY"
    },

    // Cys
    C: {
      codons: [
        { codon: "TGC", fraction: 0.52, isPreferred: true },
        { codon: "TGT", fraction: 0.48 },
      ],
      degenerate: "TGY"
    },

    // Trp
    W: {
      codons: [
        { codon: "TGG", fraction: 1, isPreferred: true },
      ],
      degenerate: "TGG"
    },

    // Stop
    STOP: {
      codons: [
        { codon: "TGA", fraction: 0.47, isPreferred: true },
        { codon: "TAA", fraction: 0.29 },
        { codon: "TAG", fraction: 0.24 },
      ],
      degenerate: "TRR"
    },

    // Leu
    L: {
      codons: [
        { codon: "CTG", fraction: 0.39, isPreferred: true },
        { codon: "CTC", fraction: 0.20 },
        { codon: "TTG", fraction: 0.13 },
        { codon: "CTT", fraction: 0.13 },
        { codon: "CTA", fraction: 0.08 },
        { codon: "TTA", fraction: 0.07 },
      ],
      degenerate: "YTN"
    },

    // Pro
    P: {
      codons: [
        { codon: "CCT", fraction: 0.31, isPreferred: true },
        { codon: "CCC", fraction: 0.30 },
        { codon: "CCA", fraction: 0.29 },
        { codon: "CCG", fraction: 0.10 },
      ],
      degenerate: "CCN"
    },

    // His
    H: {
      codons: [
        { codon: "CAC", fraction: 0.59, isPreferred: true },
        { codon: "CAT", fraction: 0.41 },
      ],
      degenerate: "CAY"
    },

    // Gln
    Q: {
      codons: [
        { codon: "CAG", fraction: 0.74, isPreferred: true },
        { codon: "CAA", fraction: 0.26 },
      ],
      degenerate: "CAR"
    },

    // Arg
    R: {
      codons: [
        { codon: "AGG", fraction: 0.22, isPreferred: true },
        { codon: "AGA", fraction: 0.22 },
        { codon: "CGG", fraction: 0.18 },
        { codon: "CGC", fraction: 0.17 },
        { codon: "CGA", fraction: 0.12 },
        { codon: "CGT", fraction: 0.09 },
      ],
      degenerate: "CGN/AGR"
    },

    // Ile
    I: {
      codons: [
        { codon: "ATC", fraction: 0.50, isPreferred: true },
        { codon: "ATT", fraction: 0.34 },
        { codon: "ATA", fraction: 0.16 },
      ],
      degenerate: "ATH"
    },

    // Thr
    T: {
      codons: [
        { codon: "ACC", fraction: 0.35, isPreferred: true },
        { codon: "ACA", fraction: 0.29 },
        { codon: "ACT", fraction: 0.25 },
        { codon: "ACG", fraction: 0.10 },
      ],
      degenerate: "ACN"
    },

    // Asn
    N: {
      codons: [
        { codon: "AAC", fraction: 0.57, isPreferred: true },
        { codon: "AAT", fraction: 0.43 },
      ],
      degenerate: "AAY"
    },

    // Lys
    K: {
      codons: [
        { codon: "AAG", fraction: 0.61, isPreferred: true },
        { codon: "AAA", fraction: 0.39 },
      ],
      degenerate: "AAR"
    },

    // Met
    M: {
      codons: [
        { codon: "ATG", fraction: 1, isPreferred: true },
      ],
      degenerate: "ATG"
    },

    // Val
    V: {
      codons: [
        { codon: "GTG", fraction: 0.46, isPreferred: true },
        { codon: "GTC", fraction: 0.25 },
        { codon: "GTT", fraction: 0.17 },
        { codon: "GTA", fraction: 0.12 },
      ],
      degenerate: "GTN"
    },

    // Ala
    A: {
      codons: [
        { codon: "GCC", fraction: 0.38, isPreferred: true },
        { codon: "GCT", fraction: 0.29 },
        { codon: "GCA", fraction: 0.23 },
        { codon: "GCG", fraction: 0.09 },
      ],
      degenerate: "GCN"
    },

    // Asp
    D: {
      codons: [
        { codon: "GAC", fraction: 0.55, isPreferred: true },
        { codon: "GAT", fraction: 0.45 },
      ],
      degenerate: "GAY"
    },

    // Glu
    E: {
      codons: [
        { codon: "GAG", fraction: 0.59, isPreferred: true },
        { codon: "GAA", fraction: 0.41 },
      ],
      degenerate: "GAR"
    },

    // Gly
    G: {
      codons: [
        { codon: "GGC", fraction: 0.33, isPreferred: true },
        { codon: "GGA", fraction: 0.26 },
        { codon: "GGG", fraction: 0.24 },
        { codon: "GGT", fraction: 0.18 },
      ],
      degenerate: "GGN"
    },

  }
},

  cho: {
  name: "Cricetulus griseus (CHO)",
  code: "cho",
  geneticCode: 1,
  aaTable: {

    // Phe
    F: {
      codons: [
        { codon: "TTC", fraction: 0.53, isPreferred: true },
        { codon: "TTT", fraction: 0.47 }
      ],
      degenerate: "TTY"
    },

    // Ser
    S: {
      codons: [
        { codon: "TCT", fraction: 0.33, isPreferred: true },
        { codon: "TCC", fraction: 0.17 },
        { codon: "TCA", fraction: 0.17 },
        { codon: "AGC", fraction: 0.17 },
        { codon: "AGT", fraction: 0.12 },
        { codon: "TCG", fraction: 0.04 }
      ],
      degenerate: "TCN/AGY"
    },

    // Tyr
    Y: {
      codons: [
        { codon: "TAC", fraction: 0.56, isPreferred: true },
        { codon: "TAT", fraction: 0.44 }
      ],
      degenerate: "TAY"
    },

    // Cys
    C: {
      codons: [
        { codon: "TGC", fraction: 0.53, isPreferred: true },
        { codon: "TGT", fraction: 0.47 }
      ],
      degenerate: "TGY"
    },

    // Trp
    W: {
      codons: [
        { codon: "TGG", fraction: 1.00, isPreferred: true }
      ],
      degenerate: "TGG"
    },

    // Stop
    STOP: {
      codons: [
        { codon: "TAA", fraction: 0.53, isPreferred: true },
        { codon: "TAG", fraction: 0.47 },
        { codon: "TGA", fraction: 0.00 }
      ],
      degenerate: "TRR"
    },

    // Leu
    L: {
      codons: [
        { codon: "CTG", fraction: 0.39, isPreferred: true },
        { codon: "CTC", fraction: 0.19 },
        { codon: "TTG", fraction: 0.14 },
        { codon: "CTT", fraction: 0.13 },
        { codon: "CTA", fraction: 0.08 },
        { codon: "TTA", fraction: 0.06 }
      ],
      degenerate: "YTN"
    },

    // Pro
    P: {
      codons: [
        { codon: "CCT", fraction: 0.31, isPreferred: true },
        { codon: "CCC", fraction: 0.30 },
        { codon: "CCA", fraction: 0.29 },
        { codon: "CCG", fraction: 0.10 }
      ],
      degenerate: "CCN"
    },

    // His
    H: {
      codons: [
        { codon: "CAC", fraction: 0.56, isPreferred: true },
        { codon: "CAT", fraction: 0.44 }
      ],
      degenerate: "CAY"
    },

    // Gln
    Q: {
      codons: [
        { codon: "CAG", fraction: 0.76, isPreferred: true },
        { codon: "CAA", fraction: 0.24 }
      ],
      degenerate: "CAR"
    },

    // Arg
    R: {
      codons: [
        { codon: "CGG", fraction: 0.226, isPreferred: true },
        { codon: "CGC", fraction: 0.212 },
        { codon: "CGT", fraction: 0.124 },
        { codon: "CGA", fraction: 0.161 },
        { codon: "AGG", fraction: 0.277 },
        { codon: "AGA", fraction: 0.000 },
      ],
      degenerate: "CGN/AGR"
    },

    // Ile
    I: {
      codons: [
        { codon: "ATC", fraction: 0.51, isPreferred: true },
        { codon: "ATT", fraction: 0.35 },
        { codon: "ATA", fraction: 0.14 }
      ],
      degenerate: "ATH"
    },

    // Thr
    T: {
      codons: [
        { codon: "ACC", fraction: 0.37, isPreferred: true },
        { codon: "ACA", fraction: 0.29 },
        { codon: "ACT", fraction: 0.26 },
        { codon: "ACG", fraction: 0.08 }
      ],
      degenerate: "ACN"
    },

    // Asn
    N: {
      codons: [
        { codon: "AAC", fraction: 0.53, isPreferred: true },
        { codon: "AAT", fraction: 0.47 }
      ],
      degenerate: "AAY"
    },

    // Lys
    K: {
      codons: [
        { codon: "AAA", fraction: 0.73, isPreferred: true },
        { codon: "AAG", fraction: 0.27 }
      ],
      degenerate: "AAR"
    },

    // Met
    M: {
      codons: [
        { codon: "ATG", fraction: 1.00, isPreferred: true }
      ],
      degenerate: "ATG"
    },

    // Val
    V: {
      codons: [
        { codon: "GTC", fraction: 0.24, isPreferred: true },
        { codon: "GTA", fraction: 0.26 },
        { codon: "GTT", fraction: 0.18 },
        { codon: "GTG", fraction: 0.32 }
      ],
      degenerate: "GTN"
    },

    // Ala
    A: {
      codons: [
        { codon: "GCC", fraction: 0.37, isPreferred: true },
        { codon: "GCT", fraction: 0.32 },
        { codon: "GCA", fraction: 0.20 },
        { codon: "GCG", fraction: 0.11 }
      ],
      degenerate: "GCN"
    },

    // Asp
    D: {
      codons: [
        { codon: "GAC", fraction: 0.55, isPreferred: true },
        { codon: "GAT", fraction: 0.45 }
      ],
      degenerate: "GAY"
    },

    // Glu
    E: {
      codons: [
        { codon: "GAG", fraction: 0.59, isPreferred: true },
        { codon: "GAA", fraction: 0.41 }
      ],
      degenerate: "GAR"
    },

    // Gly
    G: {
      codons: [
        { codon: "GGC", fraction: 0.34, isPreferred: true },
        { codon: "GGA", fraction: 0.25 },
        { codon: "GGG", fraction: 0.21 },
        { codon: "GGT", fraction: 0.20 }
      ],
      degenerate: "GGN"
    }
  }
},

hek293: {
  name: "HEK293 (Human embryonic kidney cells)",
  code: "hek293",
  geneticCode: 1,
  aaTable: {

    // Phe
    F: {
      codons: [
        { codon: "TTC", fraction: 0.54, isPreferred: true },
        { codon: "TTT", fraction: 0.46 },
      ],
      degenerate: "TTY"
    },

    // Ser
    S: {
      codons: [
        { codon: "AGC", fraction: 0.24, isPreferred: true },
        { codon: "TCC", fraction: 0.22 },
        { codon: "TCT", fraction: 0.20 },
        { codon: "AGT", fraction: 0.15 },
        { codon: "TCA", fraction: 0.14 },
        { codon: "TCG", fraction: 0.05 },
      ],
      degenerate: "TCN/AGY"
    },

    // Tyr
    Y: {
      codons: [
        { codon: "TAC", fraction: 0.56, isPreferred: true },
        { codon: "TAT", fraction: 0.44 },
      ],
      degenerate: "TAY"
    },

    // Cys
    C: {
      codons: [
        { codon: "TGC", fraction: 0.54, isPreferred: true },
        { codon: "TGT", fraction: 0.46 },
      ],
      degenerate: "TGY"
    },

    // Trp
    W: {
      codons: [
        { codon: "TGG", fraction: 1.00, isPreferred: true },
      ],
      degenerate: "TGG"
    },

    // Stop
    STOP: {
      codons: [
        { codon: "TGA", fraction: 0.47, isPreferred: true },
        { codon: "TAA", fraction: 0.29 },
        { codon: "TAG", fraction: 0.24 },
      ],
      degenerate: "TRR"
    },

    // Leu
    L: {
      codons: [
        { codon: "CTG", fraction: 0.40, isPreferred: true },
        { codon: "CTC", fraction: 0.20 },
        { codon: "TTG", fraction: 0.13 },
        { codon: "CTT", fraction: 0.13 },
        { codon: "CTA", fraction: 0.08 },
        { codon: "TTA", fraction: 0.07 },
      ],
      degenerate: "YTN"
    },

    // Pro
    P: {
      codons: [
        { codon: "CCC", fraction: 0.32, isPreferred: true },
        { codon: "CCT", fraction: 0.29 },
        { codon: "CCA", fraction: 0.28 },
        { codon: "CCG", fraction: 0.11 },
      ],
      degenerate: "CCN"
    },

    // His
    H: {
      codons: [
        { codon: "CAC", fraction: 0.58, isPreferred: true },
        { codon: "CAT", fraction: 0.42 },
      ],
      degenerate: "CAY"
    },

    // Gln
    Q: {
      codons: [
        { codon: "CAG", fraction: 0.73, isPreferred: true },
        { codon: "CAA", fraction: 0.27 },
      ],
      degenerate: "CAR"
    },

    // Arg
    R: {
      codons: [
        { codon: "AGG", fraction: 0.21, isPreferred: true },
        { codon: "AGA", fraction: 0.21 },
        { codon: "CGG", fraction: 0.20 },
        { codon: "CGC", fraction: 0.18 },
        { codon: "CGA", fraction: 0.11 },
        { codon: "CGT", fraction: 0.09 },
      ],
      degenerate: "CGN/AGR"
    },

    // Ile
    I: {
      codons: [
        { codon: "ATC", fraction: 0.47, isPreferred: true },
        { codon: "ATT", fraction: 0.36 },
        { codon: "ATA", fraction: 0.17 },
      ],
      degenerate: "ATH"
    },

    // Thr
    T: {
      codons: [
        { codon: "ACC", fraction: 0.36, isPreferred: true },
        { codon: "ACA", fraction: 0.28 },
        { codon: "ACT", fraction: 0.25 },
        { codon: "ACG", fraction: 0.11 },
      ],
      degenerate: "ACN"
    },

    // Asn
    N: {
      codons: [
        { codon: "AAC", fraction: 0.53, isPreferred: true },
        { codon: "AAT", fraction: 0.47 },
      ],
      degenerate: "AAY"
    },

    // Lys
    K: {
      codons: [
        { codon: "AAG", fraction: 0.57, isPreferred: true },
        { codon: "AAA", fraction: 0.43 },
      ],
      degenerate: "AAR"
    },

    // Met
    M: {
      codons: [
        { codon: "ATG", fraction: 1.00, isPreferred: true },
      ],
      degenerate: "ATG"
    },

    // Val
    V: {
      codons: [
        { codon: "GTG", fraction: 0.46, isPreferred: true },
        { codon: "GTC", fraction: 0.24 },
        { codon: "GTT", fraction: 0.18 },
        { codon: "GTA", fraction: 0.12 },
      ],
      degenerate: "GTN"
    },

    // Ala
    A: {
      codons: [
        { codon: "GCC", fraction: 0.40, isPreferred: true },
        { codon: "GCT", fraction: 0.27 },
        { codon: "GCA", fraction: 0.23 },
        { codon: "GCG", fraction: 0.11 },
      ],
      degenerate: "GCN"
    },

    // Asp
    D: {
      codons: [
        { codon: "GAC", fraction: 0.54, isPreferred: true },
        { codon: "GAT", fraction: 0.46 },
      ],
      degenerate: "GAY"
    },

    // Glu
    E: {
      codons: [
        { codon: "GAG", fraction: 0.58, isPreferred: true },
        { codon: "GAA", fraction: 0.42 },
      ],
      degenerate: "GAR"
    },

    // Gly
    G: {
      codons: [
        { codon: "GGC", fraction: 0.34, isPreferred: true },
        { codon: "GGA", fraction: 0.25 },
        { codon: "GGG", fraction: 0.25 },
        { codon: "GGT", fraction: 0.16 },
      ],
      degenerate: "GGN"
    },
  }
},

  // Plants
arabidopsis: {
  name: "Arabidopsis thaliana",
  code: "arabidopsis",
  geneticCode: 1,
  aaTable: {

    // Phe
    F: {
      codons: [
        { codon: "TTT", fraction: 0.55, isPreferred: true },
        { codon: "TTC", fraction: 0.45 }
      ],
      degenerate: "TTY"
    },

    // Ser
    S: {
      codons: [
        { codon: "TCT", fraction: 0.26, isPreferred: true },
        { codon: "TCC", fraction: 0.21 },
        { codon: "TCA", fraction: 0.17 },
        { codon: "AGT", fraction: 0.16 },
        { codon: "AGC", fraction: 0.12 },
        { codon: "TCG", fraction: 0.08 }
      ],
      degenerate: "TCN/AGY"
    },

    // Tyr
    Y: {
      codons: [
        { codon: "TAT", fraction: 0.58, isPreferred: true },
        { codon: "TAC", fraction: 0.42 }
      ],
      degenerate: "TAY"
    },

    // Cys
    C: {
      codons: [
        { codon: "TGT", fraction: 0.62, isPreferred: true },
        { codon: "TGC", fraction: 0.38 }
      ],
      degenerate: "TGY"
    },

    // Trp
    W: {
      codons: [
        { codon: "TGG", fraction: 1.00, isPreferred: true }
      ],
      degenerate: "TGG"
    },

    // Stop
    STOP: {
      codons: [
        { codon: "TGA", fraction: 0.47, isPreferred: true },
        { codon: "TAA", fraction: 0.34 },
        { codon: "TAG", fraction: 0.19 }
      ],
      degenerate: "TRR"
    },

    // Leu
    L: {
      codons: [
        { codon: "TTA", fraction: 0.30, isPreferred: true },
        { codon: "TTG", fraction: 0.23 },
        { codon: "CTT", fraction: 0.17 },
        { codon: "CTA", fraction: 0.13 },
        { codon: "CTC", fraction: 0.10 },
        { codon: "CTG", fraction: 0.07 }
      ],
      degenerate: "YTN"
    },

    // Pro
    P: {
      codons: [
        { codon: "CCA", fraction: 0.38, isPreferred: true },
        { codon: "CCT", fraction: 0.28 },
        { codon: "CCC", fraction: 0.20 },
        { codon: "CCG", fraction: 0.14 }
      ],
      degenerate: "CCN"
    },

    // His
    H: {
      codons: [
        { codon: "CAT", fraction: 0.58, isPreferred: true },
        { codon: "CAC", fraction: 0.42 }
      ],
      degenerate: "CAY"
    },

    // Gln
    Q: {
      codons: [
        { codon: "CAA", fraction: 0.66, isPreferred: true },
        { codon: "CAG", fraction: 0.34 }
      ],
      degenerate: "CAR"
    },

    // Arg
    R: {
      codons: [
        { codon: "AGA", fraction: 0.42, isPreferred: true },
        { codon: "AGG", fraction: 0.22 },
        { codon: "CGT", fraction: 0.14 },
        { codon: "CGA", fraction: 0.10 },
        { codon: "CGC", fraction: 0.07 },
        { codon: "CGG", fraction: 0.05 }
      ],
      degenerate: "CGN/AGR"
    },

    // Ile
    I: {
      codons: [
        { codon: "ATT", fraction: 0.46, isPreferred: true },
        { codon: "ATA", fraction: 0.29 },
        { codon: "ATC", fraction: 0.25 }
      ],
      degenerate: "ATH"
    },

    // Thr
    T: {
      codons: [
        { codon: "ACT", fraction: 0.35, isPreferred: true },
        { codon: "ACA", fraction: 0.31 },
        { codon: "ACC", fraction: 0.22 },
        { codon: "ACG", fraction: 0.12 }
      ],
      degenerate: "ACN"
    },

    // Asn
    N: {
      codons: [
        { codon: "AAT", fraction: 0.57, isPreferred: true },
        { codon: "AAC", fraction: 0.43 }
      ],
      degenerate: "AAY"
    },

    // Lys
    K: {
      codons: [
        { codon: "AAA", fraction: 0.53, isPreferred: true },
        { codon: "AAG", fraction: 0.47 }
      ],
      degenerate: "AAR"
    },

    // Met
    M: {
      codons: [
        { codon: "ATG", fraction: 1.00, isPreferred: true }
      ],
      degenerate: "ATG"
    },

    // Val
    V: {
      codons: [
        { codon: "GTT", fraction: 0.35, isPreferred: true },
        { codon: "GTA", fraction: 0.24 },
        { codon: "GTC", fraction: 0.22 },
        { codon: "GTG", fraction: 0.19 }
      ],
      degenerate: "GTN"
    },

    // Ala
    A: {
      codons: [
        { codon: "GCT", fraction: 0.34, isPreferred: true },
        { codon: "GCA", fraction: 0.30 },
        { codon: "GCC", fraction: 0.23 },
        { codon: "GCG", fraction: 0.13 }
      ],
      degenerate: "GCN"
    },

    // Asp
    D: {
      codons: [
        { codon: "GAT", fraction: 0.62, isPreferred: true },
        { codon: "GAC", fraction: 0.38 }
      ],
      degenerate: "GAY"
    },

    // Glu
    E: {
      codons: [
        { codon: "GAA", fraction: 0.67, isPreferred: true },
        { codon: "GAG", fraction: 0.33 }
      ],
      degenerate: "GAR"
    },

    // Gly
    G: {
      codons: [
        { codon: "GGT", fraction: 0.43, isPreferred: true },
        { codon: "GGA", fraction: 0.23 },
        { codon: "GGC", fraction: 0.19 },
        { codon: "GGG", fraction: 0.15 }
      ],
      degenerate: "GGN"
    }
  }
},

 rice: {
  name: "Oryza sativa (Rice)",
  code: "rice",
  geneticCode: 1,
  aaTable: {

    // Phe
    F: {
      codons: [
        { codon: "TTT", fraction: 0.58, isPreferred: true },
        { codon: "TTC", fraction: 0.42 }
      ],
      degenerate: "TTY"
    },

    // Ser
    S: {
      codons: [
        { codon: "TCT", fraction: 0.27, isPreferred: true },
        { codon: "TCC", fraction: 0.21 },
        { codon: "TCA", fraction: 0.19 },
        { codon: "AGT", fraction: 0.15 },
        { codon: "AGC", fraction: 0.10 },
        { codon: "TCG", fraction: 0.08 }
      ],
      degenerate: "TCN/AGY"
    },

    // Tyr
    Y: {
      codons: [
        { codon: "TAT", fraction: 0.60, isPreferred: true },
        { codon: "TAC", fraction: 0.40 }
      ],
      degenerate: "TAY"
    },

    // Cys
    C: {
      codons: [
        { codon: "TGT", fraction: 0.67, isPreferred: true },
        { codon: "TGC", fraction: 0.33 }
      ],
      degenerate: "TGY"
    },

    // Trp
    W: {
      codons: [
        { codon: "TGG", fraction: 1.00, isPreferred: true }
      ],
      degenerate: "TGG"
    },

    // Stop
    STOP: {
      codons: [
        { codon: "TGA", fraction: 0.45, isPreferred: true },
        { codon: "TAA", fraction: 0.35 },
        { codon: "TAG", fraction: 0.20 }
      ],
      degenerate: "TRR"
    },

    // Leu
    L: {
      codons: [
        { codon: "TTA", fraction: 0.33, isPreferred: true },
        { codon: "TTG", fraction: 0.23 },
        { codon: "CTT", fraction: 0.17 },
        { codon: "CTA", fraction: 0.12 },
        { codon: "CTC", fraction: 0.09 },
        { codon: "CTG", fraction: 0.06 }
      ],
      degenerate: "YTN"
    },

    // Pro
    P: {
      codons: [
        { codon: "CCA", fraction: 0.39, isPreferred: true },
        { codon: "CCT", fraction: 0.29 },
        { codon: "CCC", fraction: 0.20 },
        { codon: "CCG", fraction: 0.12 }
      ],
      degenerate: "CCN"
    },

    // His
    H: {
      codons: [
        { codon: "CAT", fraction: 0.60, isPreferred: true },
        { codon: "CAC", fraction: 0.40 }
      ],
      degenerate: "CAY"
    },

    // Gln
    Q: {
      codons: [
        { codon: "CAA", fraction: 0.68, isPreferred: true },
        { codon: "CAG", fraction: 0.32 }
      ],
      degenerate: "CAR"
    },

    // Arg
    R: {
      codons: [
        { codon: "AGA", fraction: 0.42, isPreferred: true },
        { codon: "AGG", fraction: 0.22 },
        { codon: "CGT", fraction: 0.14 },
        { codon: "CGA", fraction: 0.10 },
        { codon: "CGC", fraction: 0.07 },
        { codon: "CGG", fraction: 0.05 }
      ],
      degenerate: "CGN/AGR"
    },

    // Ile
    I: {
      codons: [
        { codon: "ATT", fraction: 0.47, isPreferred: true },
        { codon: "ATA", fraction: 0.28 },
        { codon: "ATC", fraction: 0.25 }
      ],
      degenerate: "ATH"
    },

    // Thr
    T: {
      codons: [
        { codon: "ACT", fraction: 0.35, isPreferred: true },
        { codon: "ACA", fraction: 0.30 },
        { codon: "ACC", fraction: 0.22 },
        { codon: "ACG", fraction: 0.13 }
      ],
      degenerate: "ACN"
    },

    // Asn
    N: {
      codons: [
        { codon: "AAT", fraction: 0.58, isPreferred: true },
        { codon: "AAC", fraction: 0.42 }
      ],
      degenerate: "AAY"
    },

    // Lys
    K: {
      codons: [
        { codon: "AAA", fraction: 0.54, isPreferred: true },
        { codon: "AAG", fraction: 0.46 }
      ],
      degenerate: "AAR"
    },

    // Met
    M: {
      codons: [
        { codon: "ATG", fraction: 1.00, isPreferred: true }
      ],
      degenerate: "ATG"
    },

    // Val
    V: {
      codons: [
        { codon: "GTT", fraction: 0.36, isPreferred: true },
        { codon: "GTA", fraction: 0.24 },
        { codon: "GTC", fraction: 0.22 },
        { codon: "GTG", fraction: 0.18 }
      ],
      degenerate: "GTN"
    },

    // Ala
    A: {
      codons: [
        { codon: "GCT", fraction: 0.35, isPreferred: true },
        { codon: "GCA", fraction: 0.30 },
        { codon: "GCC", fraction: 0.23 },
        { codon: "GCG", fraction: 0.12 }
      ],
      degenerate: "GCN"
    },

    // Asp
    D: {
      codons: [
        { codon: "GAT", fraction: 0.63, isPreferred: true },
        { codon: "GAC", fraction: 0.37 }
      ],
      degenerate: "GAY"
    },

    // Glu
    E: {
      codons: [
        { codon: "GAA", fraction: 0.66, isPreferred: true },
        { codon: "GAG", fraction: 0.34 }
      ],
      degenerate: "GAR"
    },

    // Gly
    G: {
      codons: [
        { codon: "GGT", fraction: 0.44, isPreferred: true },
        { codon: "GGA", fraction: 0.23 },
        { codon: "GGC", fraction: 0.19 },
        { codon: "GGG", fraction: 0.14 }
      ],
      degenerate: "GGN"
    }
  }
},

 n_benthamiana: {
  name: "Nicotiana benthamiana (approximated using Nicotiana tabacum)",
  code: "n_benthamiana",
  geneticCode: 1,
  aaTable: {

    // Phe
    F: {
      codons: [
        { codon: "TTT", fraction: 0.57, isPreferred: true },
        { codon: "TTC", fraction: 0.43 }
      ],
      degenerate: "TTY"
    },

    // Ser
    S: {
      codons: [
        { codon: "TCT", fraction: 0.26, isPreferred: true },
        { codon: "TCC", fraction: 0.21 },
        { codon: "TCA", fraction: 0.18 },
        { codon: "AGT", fraction: 0.16 },
        { codon: "AGC", fraction: 0.11 },
        { codon: "TCG", fraction: 0.08 }
      ],
      degenerate: "TCN/AGY"
    },

    // Tyr
    Y: {
      codons: [
        { codon: "TAT", fraction: 0.60, isPreferred: true },
        { codon: "TAC", fraction: 0.40 }
      ],
      degenerate: "TAY"
    },

    // Cys
    C: {
      codons: [
        { codon: "TGT", fraction: 0.69, isPreferred: true },
        { codon: "TGC", fraction: 0.31 }
      ],
      degenerate: "TGY"
    },

    // Trp
    W: {
      codons: [
        { codon: "TGG", fraction: 1.00, isPreferred: true }
      ],
      degenerate: "TGG"
    },

    // Stop
    STOP: {
      codons: [
        { codon: "TGA", fraction: 0.45, isPreferred: true },
        { codon: "TAA", fraction: 0.36 },
        { codon: "TAG", fraction: 0.19 }
      ],
      degenerate: "TRR"
    },

    // Leu
    L: {
      codons: [
        { codon: "TTA", fraction: 0.32, isPreferred: true },
        { codon: "TTG", fraction: 0.23 },
        { codon: "CTT", fraction: 0.17 },
        { codon: "CTA", fraction: 0.12 },
        { codon: "CTC", fraction: 0.09 },
        { codon: "CTG", fraction: 0.07 }
      ],
      degenerate: "YTN"
    },

    // Pro
    P: {
      codons: [
        { codon: "CCA", fraction: 0.40, isPreferred: true },
        { codon: "CCT", fraction: 0.29 },
        { codon: "CCC", fraction: 0.20 },
        { codon: "CCG", fraction: 0.11 }
      ],
      degenerate: "CCN"
    },

    // His
    H: {
      codons: [
        { codon: "CAT", fraction: 0.59, isPreferred: true },
        { codon: "CAC", fraction: 0.41 }
      ],
      degenerate: "CAY"
    },

    // Gln
    Q: {
      codons: [
        { codon: "CAA", fraction: 0.69, isPreferred: true },
        { codon: "CAG", fraction: 0.31 }
      ],
      degenerate: "CAR"
    },

    // Arg
    R: {
      codons: [
        { codon: "AGA", fraction: 0.42, isPreferred: true },
        { codon: "AGG", fraction: 0.22 },
        { codon: "CGT", fraction: 0.14 },
        { codon: "CGA", fraction: 0.10 },
        { codon: "CGC", fraction: 0.07 },
        { codon: "CGG", fraction: 0.05 }
      ],
      degenerate: "CGN/AGR"
    },

    // Ile
    I: {
      codons: [
        { codon: "ATT", fraction: 0.47, isPreferred: true },
        { codon: "ATA", fraction: 0.28 },
        { codon: "ATC", fraction: 0.25 }
      ],
      degenerate: "ATH"
    },

    // Thr
    T: {
      codons: [
        { codon: "ACT", fraction: 0.35, isPreferred: true },
        { codon: "ACA", fraction: 0.30 },
        { codon: "ACC", fraction: 0.22 },
        { codon: "ACG", fraction: 0.13 }
      ],
      degenerate: "ACN"
    },

    // Asn
    N: {
      codons: [
        { codon: "AAT", fraction: 0.58, isPreferred: true },
        { codon: "AAC", fraction: 0.42 }
      ],
      degenerate: "AAY"
    },

    // Lys
    K: {
      codons: [
        { codon: "AAA", fraction: 0.54, isPreferred: true },
        { codon: "AAG", fraction: 0.46 }
      ],
      degenerate: "AAR"
    },

    // Met
    M: {
      codons: [
        { codon: "ATG", fraction: 1.00, isPreferred: true }
      ],
      degenerate: "ATG"
    },

    // Val
    V: {
      codons: [
        { codon: "GTT", fraction: 0.36, isPreferred: true },
        { codon: "GTA", fraction: 0.24 },
        { codon: "GTC", fraction: 0.22 },
        { codon: "GTG", fraction: 0.18 }
      ],
      degenerate: "GTN"
    },

    // Ala
    A: {
      codons: [
        { codon: "GCT", fraction: 0.35, isPreferred: true },
        { codon: "GCA", fraction: 0.30 },
        { codon: "GCC", fraction: 0.23 },
        { codon: "GCG", fraction: 0.12 }
      ],
      degenerate: "GCN"
    },

    // Asp
    D: {
      codons: [
        { codon: "GAT", fraction: 0.63, isPreferred: true },
        { codon: "GAC", fraction: 0.37 }
      ],
      degenerate: "GAY"
    },

    // Glu
    E: {
      codons: [
        { codon: "GAA", fraction: 0.66, isPreferred: true },
        { codon: "GAG", fraction: 0.34 }
      ],
      degenerate: "GAR"
    },

    // Gly
    G: {
      codons: [
        { codon: "GGT", fraction: 0.44, isPreferred: true },
        { codon: "GGA", fraction: 0.23 },
        { codon: "GGC", fraction: 0.19 },
        { codon: "GGG", fraction: 0.14 }
      ],
      degenerate: "GGN"
    }
  }
},


// Helper: get codon entries for (organism, amino acid)
// Returns [{codon, fraction, isPreferred?}, ...] or null.
};

export function getCodonEntries(orgCode, aa) {
  const org = CODON_USAGE[orgCode];
  if (!org) return null;
  const entry = org.aaTable[aa.toUpperCase()];
  return entry ? entry.codons : null;
}

// Helper: get preferred codon for (organism, amino acid).
export function getPreferredCodon(orgCode, aa) {
  const entries = getCodonEntries(orgCode, aa);
  if (!entries || !entries.length) return null;
  const flagged = entries.find(c => c.isPreferred);
  return flagged ? flagged.codon : entries[0].codon;
}

// Helper: get degenerate code (e.g., GCN) for an amino acid, if defined.
export function getDegenerateCode(orgCode, aa) {
  const org = CODON_USAGE[orgCode];
  if (!org) return null;
  const entry = org.aaTable[aa.toUpperCase()];
  return entry ? entry.degenerate || null : null;
}
