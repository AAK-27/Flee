import Phaser from 'phaser';
import { LevelLoader } from '../utils/LevelLoader';

export class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    init(data) {
        this.currentLevel = data.level || 1;
        this.maxLevels = 15;
    }

    preload() {
        for (let i = 1; i <= this.maxLevels; i++) {
            this.load.text(`level${i}`, `assets/levels/level${i}.txt`);
        }
        this.load.image('wall', 'assets/wall.png');
        this.load.image('player_idle', 'assets/idle_front.png');
    }

    create() {
        this.cursors = this.input.keyboard.createCursorKeys();

        const loader = new LevelLoader(this);

        const levelEntities = loader.loadLevel(`level${this.currentLevel}`);

        this.player = levelEntities.player;
        this.walls = levelEntities.walls;
        this.obstacles = levelEntities.obstacles;
        this.exit = levelEntities.exit;

        if (this.player) {
            this.physics.add.collider(this.player, this.walls);
            this.physics.add.collider(this.player, this.obstacles);
            this.physics.add.overlap(this.player, this.exit, () => {
                this.onLevelComplete();
            });
        }
    }

    update() {
        if (this.cursors.left.isDown)
        {
            this.player.setVelocityX(-300);
        }
        else if (this.cursors.right.isDown)
        {
            this.player.setVelocityX(300);
        }
        else if (this.cursors.up.isDown)
        {
            this.player.setVelocityY(-300);
        }
        else if (this.cursors.down.isDown)
        {
            this.player.setVelocityY(300);
        }
    }

    onLevelComplete() {
        this.physics.pause();
        this.currentLevel++;

        if (this.currentLevel > this.maxLevels) {
            this.currentLevel = 1;
            this.scene.start('MainMenuScene');
        } else {
            this.scene.restart({ level: this.currentLevel });
        }
    }
}