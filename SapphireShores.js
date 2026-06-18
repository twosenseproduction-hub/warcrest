
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
	editorCreate() {

		// sapphireShores
		const sapphireShores = this.add.tilemap("sapphire-shores");

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
