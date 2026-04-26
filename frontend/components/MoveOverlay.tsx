"use client";

import React, { useEffect, useState, useMemo } from "react";

interface MoveOverlayProps {
    bestMove: string | null;
    secondBestMove: string | null;
    boardWidth: number;
    flipped?: boolean;
}

function squareToCoords(square: string, boardWidth: number, flipped: boolean) {
    const file = square.charCodeAt(0) - 97; // a=0..h=7
    const rank = parseInt(square[1]) - 1;   // 1=0..8=7

    const col = flipped ? 7 - file : file;
    const row = flipped ? rank : 7 - rank;

    const cellSize = boardWidth / 8;
    const x = col * cellSize + cellSize / 2;
    const y = row * cellSize + cellSize / 2;
    return { x, y };
}

interface ArrowProps {
    from: string;
    to: string;
    color: string;
    boardWidth: number;
    flipped: boolean;
    opacity: number;
}

function Arrow({ from, to, color, boardWidth, flipped, opacity }: ArrowProps) {
    const start = useMemo(() => squareToCoords(from, boardWidth, flipped), [from, boardWidth, flipped]);
    const end = useMemo(() => squareToCoords(to, boardWidth, flipped), [to, boardWidth, flipped]);

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return null;

    const cellSize = boardWidth / 8;
    const arrowHeadSize = cellSize * 0.38;
    const shaftWidth = cellSize * 0.13;

    // Shorten the end by arrowhead size
    const ux = dx / len;
    const uy = dy / len;
    const endX = end.x - ux * arrowHeadSize * 0.7;
    const endY = end.y - uy * arrowHeadSize * 0.7;
    const startX = start.x + ux * cellSize * 0.25;
    const startY = start.y + uy * cellSize * 0.25;

    const markerId = `arrowhead-${color.replace(/[^a-z0-9]/gi, '')}-${Math.random().toString(36).substr(2, 5)}`;

    return (
        <g style={{ opacity }}>
            <defs>
                <marker
                    id={markerId}
                    markerWidth="4"
                    markerHeight="4"
                    refX="2"
                    refY="2"
                    orient="auto"
                >
                    <polygon
                        points="0 0, 4 2, 0 4"
                        fill={color}
                    />
                </marker>
            </defs>
            <line
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke={color}
                strokeWidth={shaftWidth}
                strokeLinecap="round"
                markerEnd={`url(#${markerId})`}
            />
        </g>
    );
}

export default function MoveOverlay({
    bestMove,
    secondBestMove,
    boardWidth,
    flipped = false,
}: MoveOverlayProps) {
    const [opacity, setOpacity] = useState(0);

    useEffect(() => {
        if (!bestMove) {
            setOpacity(0);
            return;
        }
        // Fade in
        setOpacity(0);
        const fadeIn = setTimeout(() => setOpacity(1), 50);
        // Fade out after 2.5s
        const fadeOut = setTimeout(() => setOpacity(0), 2800);
        return () => {
            clearTimeout(fadeIn);
            clearTimeout(fadeOut);
        };
    }, [bestMove, secondBestMove]);

    if (!bestMove) return null;

    const parseMove = (uci: string) => {
        if (!uci || uci.length < 4) return null;
        return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
    };

    const best = parseMove(bestMove);
    const second = secondBestMove ? parseMove(secondBestMove) : null;

    return (
        <svg
            width={boardWidth}
            height={boardWidth}
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                pointerEvents: "none",
                transition: "opacity 0.4s ease",
                opacity,
                zIndex: 10,
            }}
        >
            {second && (
                <Arrow
                    from={second.from}
                    to={second.to}
                    color="#FFD700"
                    boardWidth={boardWidth}
                    flipped={flipped}
                    opacity={0.75}
                />
            )}
            {best && (
                <Arrow
                    from={best.from}
                    to={best.to}
                    color="#22C55E"
                    boardWidth={boardWidth}
                    flipped={flipped}
                    opacity={0.9}
                />
            )}
        </svg>
    );
}