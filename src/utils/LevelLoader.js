export class LevelLoader {

    constructor(scene) {
        this.scene = scene;
    }

    // Loads a level with the corresponding key and returns the level element objects
    loadLevel(cacheKey) {
        const walls = this.scene.physics.add.staticGroup();
        const obstacles = this.scene.physics.add.group();
        let player = null;
        let exit = null;

        const levelData = this.scene.cache.text.get(cacheKey);
        if (!levelData) {
            console.error(`Level data for key "${cacheKey}" not found!`);
            return { walls, obstacles, player }
        }

        const tiles = levelData.trim().replace('/\r/g', '').split('\n');
        const numRows = tiles.length;
        const numCols = tiles[0].length;
        const tileSize = Math.min(this.scene.scale.height / numRows, this.scene.scale.width / numCols);

        tiles.forEach((row, y) => {
            const tiles = row.split('');
            tiles.forEach((tile, x) => {
                const posX = x * tileSize + tileSize / 2;
                const posY = y * tileSize + tileSize / 2;

                switch (tile) {
                    case '#':
                        walls.create(posX, posY, 'wall').setDisplaySize(tileSize, tileSize).refreshBody();
                        break;
                    case 'X':
                        const obstacle = obstacles.create(posX, posY, 'spike').setDisplaySize(tileSize, tileSize);
                        obstacle.setImmovable(true);
                        break;
                    case 'S':
                        player = this.scene.physics.add.sprite(posX, posY, 'player_idle').setDisplaySize(tileSize*0.99, tileSize*0.99);
                        player.setCollideWorldBounds(true);
                        player.setDepth(10);
                        break;
                    case 'E':
                        exit = this.scene.physics.add.staticImage(posX, posY, null).setDisplaySize(tileSize, tileSize).refreshBody();
                    default:
                        break;
                }
            });
        });

        return { walls, obstacles, player, exit };
    }
}