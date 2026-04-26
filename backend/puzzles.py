PUZZLES = [
    # Easy
    {
        "fen": "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 5",
        "best_move": "c4f7",
        "evaluation": "+2.5",
        "theme": "Sacrifice / Attack on f7",
        "difficulty": "easy",
        "hints": [
            "Focus on the weakest point in Black's camp.",
            "Look for a piece that can attack f7.",
            "A sacrifice on f7 can draw the King out.",
            "Bxf7+ is the right idea!"
        ]
    },
    {
        "fen": "rnb1kbnr/pppp1ppp/8/4p1q1/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3",
        "best_move": "d2d4",
        "evaluation": "+1.5",
        "theme": "Discovered attack / Center control",
        "difficulty": "easy",
        "hints": [
            "Attack the opponent's exposed Queen while fighting for the center.",
            "A pawn move can reveal an attack.",
            "Look at the d-file.",
            "Play d4 to attack the center and open up the dark-squared bishop."
        ]
    },
    {
        "fen": "8/8/8/6q1/8/8/5K2/7k w - - 0 1",
        "best_move": "f2f1",
        "evaluation": "0.00",
        "theme": "Stalemate trick",
        "difficulty": "easy",
        "hints": [
            "Black's King is in the corner.",
            "Can you trap the King without putting him in check?",
            "Look for a way to freeze the King.",
            "Kf1 forces a stalemate!"
        ]
    },

    # Medium
    {
        "fen": "r1b2rk1/pp1n1ppp/1q2p3/2bpP3/N4P2/3B4/PPP1Q1PP/R1B1K2R b KQ - 4 11",
        "best_move": "b6a5",
        "evaluation": "-1.5",
        "theme": "Fork",
        "difficulty": "medium",
        "hints": [
            "The White Knight on a4 is unprotected.",
            "Look for a double attack.",
            "Can the Queen attack two pieces at once?",
            "Qa5+ forks the King and the Knight!"
        ]
    },
    {
        "fen": "4rrk1/pppq2pp/2n1b3/2bnp1N1/8/P1NP4/BPP2PPP/R1BQR1K1 w - - 1 13",
        "best_move": "c3e4",
        "evaluation": "+2.0",
        "theme": "Centralization / Fork threat",
        "difficulty": "medium",
        "hints": [
            "The Black bishop on c5 is annoying.",
            "Can you improve your Knight while attacking a key piece?",
            "Jump into the center.",
            "Ne4 attacks the bishop and controls key squares."
        ]
    },
    {
        "fen": "r1bq1rk1/1pp1bppp/p1np1n2/4p3/B3P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 8",
        "best_move": "c1g5",
        "evaluation": "+0.5",
        "theme": "Pin",
        "difficulty": "medium",
        "hints": [
            "The Knight on f6 defends the center.",
            "Can you apply pressure to that Knight?",
            "Develop your dark-squared bishop with a threat.",
            "Bg5 pins the Knight to the Queen."
        ]
    },

    # Hard
    {
        "fen": "r2q1rk1/pp2bppp/2n1b3/3p4/3P4/1Q3NP1/PP3PBP/R1B2RK1 b - - 0 12",
        "best_move": "d8b6",
        "evaluation": "-0.5",
        "theme": "Positional exchange",
        "difficulty": "hard",
        "hints": [
            "White's Queen on b3 puts pressure on b7 and d5.",
            "How can you neutralize this pressure?",
            "Offer a Queen trade on favorable terms.",
            "Qb6 challenges the Queen and improves your pawn structure if exchanged."
        ]
    },
    {
        "fen": "rnbq1rk1/pp3ppp/2p1p3/3p4/2PPn3/2N1PN2/PP1Q1PPP/R3KB1R w KQ - 1 9",
        "best_move": "d2c2",
        "evaluation": "+0.8",
        "theme": "Repositioning",
        "difficulty": "hard",
        "hints": [
            "The Knight on e4 is very strong.",
            "Your Queen on d2 is somewhat awkwardly placed.",
            "Prepare to challenge the Knight.",
            "Qc2 aims at e4 and prepares to bring the Rook to the center."
        ]
    },
    {
        "fen": "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1",
        "best_move": "e1f2",
        "evaluation": "+5.0",
        "theme": "Endgame King Activity",
        "difficulty": "hard",
        "hints": [
            "In pawn endgames, King activity is crucial.",
            "Don't rush the pawn; bring the King up first.",
            "Aim to support your pawn's advance.",
            "Kf2 activates the King."
        ]
    }
]
