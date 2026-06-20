import Phaser from 'phaser';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  physics: {
    default: 'arcade',
    arcade: {
      debug:false
    }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

const game = new Phaser.Game(config);

function preload()
{
  this.load.image('player_idle', 'assets/idle_front.png');
}

var player;

function create()
{
  player = this.physics.add.sprite(100, 450, 'player_idle');
  player.setCollideWorldBounds(true);
}

var cursors;

function update()
{
  cursors = this.input.keyboard.createCursorKeys();
  if (cursors.left.isDown)
  {
    player.setVelocityX(-160);
  }
  else if (cursors.right.isDown)
  {
    player.setVelocityX(160);
  }
  else if (cursors.up.isDown)
  {
    player.setVelocityY(-160);
  }
  else if (cursors.down.isDown)
  {
    player.setVelocityY(160);
  }
}