export type FogState = 'unexplored' | 'explored' | 'visible';

type VisionUnit = {
  tileX: number;
  tileY: number;
  visionRadius: number;
};

export class FogOfWar {
  private readonly fogGrid: FogState[][];

  constructor(
    private readonly mapWidth: number,
    private readonly mapHeight: number,
  ) {
    this.fogGrid = Array.from({ length: mapHeight }, () => (
      Array.from({ length: mapWidth }, () => 'unexplored')
    ));
  }

  updateVision(units: VisionUnit[]): void {
    for (let y = 0; y < this.mapHeight; y += 1) {
      for (let x = 0; x < this.mapWidth; x += 1) {
        if (this.fogGrid[y][x] === 'visible') {
          this.fogGrid[y][x] = 'explored';
        }
      }
    }

    for (const unit of units) {
      const minX = Math.max(0, unit.tileX - unit.visionRadius);
      const maxX = Math.min(this.mapWidth - 1, unit.tileX + unit.visionRadius);
      const minY = Math.max(0, unit.tileY - unit.visionRadius);
      const maxY = Math.min(this.mapHeight - 1, unit.tileY + unit.visionRadius);

      for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const dx = x - unit.tileX;
          const dy = y - unit.tileY;

          if (Math.sqrt(dx * dx + dy * dy) <= unit.visionRadius) {
            this.fogGrid[y][x] = 'visible';
          }
        }
      }
    }
  }

  getState(tileX: number, tileY: number): FogState {
    if (!this.isInBounds(tileX, tileY)) {
      return 'unexplored';
    }

    return this.fogGrid[tileY][tileX];
  }

  isVisible(tileX: number, tileY: number): boolean {
    return this.getState(tileX, tileY) === 'visible';
  }

  private isInBounds(tileX: number, tileY: number): boolean {
    return tileX >= 0 && tileX < this.mapWidth && tileY >= 0 && tileY < this.mapHeight;
  }
}
