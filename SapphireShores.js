
// You can write more code here

/* START OF COMPILED CODE */

class SapphireShores extends Phaser.Scene {

	constructor() {
		super("SapphireShores");

		/* START-USER-CTR-CODE */
		// Write your code here.
		/* END-USER-CTR-CODE */
	}

	/** @returns {void} */
	preload() {

		this.load.pack("asset-pack", "asset-pack.json");
	}

	/** @returns {void} */
	editorCreate() {

		// sapphireShores
		const sapphireShores = this.add.tilemap("sapphire-shores");
		sapphireShores.addTilesetImage("terrain-grass", "terrain-grass");

		// ground
		sapphireShores.createLayer("ground", ["terrain-grass"], 0, 0);

		// elevated
		sapphireShores.createLayer("elevated", [], 0, 0);

		// cliffs
		sapphireShores.createLayer("cliffs", [], 0, 0);

		// tree1
		const tree1 = this.add.image(224, 32, "Bushe1", 0);
		tree1.scaleX = 2;
		tree1.scaleY = 2;

		// tree2
		const tree2 = this.add.image(288, 16, "Bushe1", 4);
		tree2.scaleX = 2;
		tree2.scaleY = 2;

		// tree3
		const tree3 = this.add.image(352, 32, "Bushe1", 8);
		tree3.scaleX = 2;
		tree3.scaleY = 2;

		// tree4
		const tree4 = this.add.image(416, 16, "Bushe1", 12);
		tree4.scaleX = 2;
		tree4.scaleY = 2;

		// tree5
		const tree5 = this.add.image(192, 80, "Bushe1", 16);
		tree5.scaleX = 2;
		tree5.scaleY = 2;

		// tree6
		const tree6 = this.add.image(256, 96, "Bushe1", 20);
		tree6.scaleX = 2;
		tree6.scaleY = 2;

		// tree7
		const tree7 = this.add.image(320, 80, "Bushe1", 24);
		tree7.scaleX = 2;
		tree7.scaleY = 2;

		// tree8
		const tree8 = this.add.image(448, 80, "Bushe1", 28);
		tree8.scaleX = 2;
		tree8.scaleY = 2;

		// tree9
		const tree9 = this.add.image(160, 144, "Bushe1", 2);
		tree9.scaleX = 2;
		tree9.scaleY = 2;

		// tree10
		const tree10 = this.add.image(224, 160, "Bushe1", 6);
		tree10.scaleX = 2;
		tree10.scaleY = 2;

		// tree11
		const tree11 = this.add.image(384, 144, "Bushe1", 10);
		tree11.scaleX = 2;
		tree11.scaleY = 2;

		// tree12
		const tree12 = this.add.image(480, 144, "Bushe1", 14);
		tree12.scaleX = 2;
		tree12.scaleY = 2;

		this.sapphireShores = sapphireShores;

		this.events.emit("scene-awake");
	}

	/** @type {Phaser.Tilemaps.Tilemap} */
	sapphireShores;

	/* START-USER-CODE */

	// Write your code here

	create() {

		this.editorCreate();
	}

	/* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
