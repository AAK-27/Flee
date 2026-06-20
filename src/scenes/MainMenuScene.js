import Phaser from 'phaser';

export class MainMenuScene extends Phaser.Scene {
    constructor() {
        super('MainMenuScene');
    }

    create() {
        const playButton = this.add.text(400, 400, 'Play', { fontSize: '25px', fill: '#FFF' })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        playButton.on('pointerdown', () => {
            this.scene.start('GameScene');
        });
    }
}