const path = require('path');
const fs = require('fs');
const moment = require('moment');
const ITEMS_FISHES = [
	206400, 206401, //tier 0
	206402, 206403, //tier 1
	206404, 206405, //tier 2
	206406, 206407, //tier 3
	206408, 206409, 206410, //tier 4
	206411, 206412, 206413, //tier 5
	206414, 206415, 206416, 206417, //tier 6
	206418, 206419, 206420, 206421, //tier 7
	206422, 206423, 206424, 206425, //tier 8
	206426, 206427, 206428, 206429, 206430, //tier 9
	206431, 206432, 206433, 206434, 206435, //tier 10
	206500, 206501, 206502, 206503, 206504, 206505 //baf
];
const ITEMS_BANKER = [60264, 160326, 170003, 210111, 216754];
const ITEMS_SELLER = [160324, 170004, 210109, 60262, 60263, 160325, 170006, 210110];
module.exports = function autoFishing(mod) {
	let rodId = null,
		enabled = false,
		playerLocation = {},
		ContractId = null,
		needToCraft = false,
		needToDecompose = false,
		needToDropFilets = false,
		needToBankFilets = false,
		needToSellFishes = false,
		noItems = false,
		invFishes = [],
		decomposeitemscount = 0,
		sellItemsCount = 0,
		lastRecipe = null,
		pcbangBanker = null,
		invBanker = null,
		scrollsInCooldown = false,
		invSeller = null,
		currentBanker = null,
		currentSeller = null,
		bankerUsed = false,
		sellerUsed = false,
		findedFillets = null,
		fishsalad = null,
		endSellingTimer = null,
		closestSellerNpc = null,
		timeouts = [], idleCheckTimer=null;

	let extendedFunctions = {
		'banker': {
			'C_PUT_WARE_ITEM': false,
		},
		'seller': {
			'C_STORE_SELL_ADD_BASKET': false,
			'S_STORE_BASKET': false,
			'C_STORE_COMMIT': false,
		}
	};

	let statistic = [],
		startTime = null,
		endTime = null,
		lastLevel = null;

	let config, settingsPath;


	//region Checks
	mod.game.initialize(['me']);
	mod.game.on('enter_game', () => {
		settingsPath = `./${mod.game.me.name}-${mod.game.serverId}.json`;
		getJsonData(settingsPath);
		for (var type in extendedFunctions) {
			for (var opcode in extendedFunctions[type]) {
				var test = mod.dispatch.protocolMap.name.get(opcode);
				if (test !== undefined && test != null) extendedFunctions[type][opcode] = true;
			}
		}
		if (config.filetmode == 'bank' && Object.values(extendedFunctions.banker).some(x => !x)) {
			config.filetmode = false;
			mod.command.message('C_PUT_WARE_ITEM not mapped, banker functions will be disabled!');
		}
		if (config.filetmode == 'sellfishes' && Object.values(extendedFunctions.seller).some(x => !x)) {
			config.filetmode = false;
			mod.command.message('C_STORE_SELL_ADD_BASKET|S_STORE_BASKET|C_STORE_COMMIT not mapped, seller functions will be disabled!');
		}
	});
	//endregion

	//region Fishing

	mod.hook('S_FISHING_BITE', 1, event => {
		if (enabled && mod.game.me.is(event.gameId)) {
			noItems = false;
			needToBankFilets = false;
			needToCraft = false;
			needToDecompose = false;
			needToDropFilets = false;
			needToSellFishes = false;
			rodId = event.rodId;
			timeouts.push(
				setTimeout(() => {
					mod.send('C_START_FISHING_MINIGAME', 1, {});
				}, rng(1000, 2000)));
		}
	})

	mod.hook('S_START_FISHING_MINIGAME', 1, event => {
		if (enabled && mod.game.me.is(event.gameId)) {
			lastLevel = event.level;
			timeouts.push(setTimeout(() => {
				mod.send('C_END_FISHING_MINIGAME', 1, {
					success: true
				});
			}, rng(config.delay, config.delay + 1000) + event.level * 50));
		}
	})
	mod.hook('S_FISHING_CATCH', 1, event => {
		if (enabled && mod.game.me.is(event.gameId)) {
			endTime = moment();
			if (startTime != null && lastLevel != null)
				statistic.push({
					level: lastLevel,
					time: endTime.diff(startTime)
				});
			startTime = moment();
			clearTimeout(idleCheckTimer);
			idleCheckTimer=setTimeout(() => {
				useRod();
			}, 300*1000);
			timeouts.push(setTimeout(() => {
				useRod();
			}, rng(5000, 6000)));
		}
	})
	mod.hook('S_FISHING_CATCH_FAIL', 1, event => {
		if (enabled && mod.game.me.is(event.gameId)) {
			console.log('S_FISHING_CATCH_FAIL');
			timeouts.push(setTimeout(() => {
				useRod();
			}, rng(5000, 6000)));
		}
	})
	mod.hook('S_SYSTEM_MESSAGE', 1, event => {
		if (enabled) {
			var message = mod.parseSystemMessage(event.message);
			if (message.id == 'SMT_CANNOT_FISHING_NON_BAIT') {
				needToCraft = true;
				startCraft();
			}
			if (message.id == 'SMT_CANNOT_FISHING_FULL_INVEN') {
				if (config.filetmode == 'sellfishes' && findedFillets != null && findedFillets.amount > 200) {
					needToSellFishes = true;
					timeouts.push(setTimeout(() => {
						getInventory();
					}, 2000));
				} else {
					needToDecompose = true;
					requestDecomposition();
				}
			}
			if (message.id == 'SMT_ITEM_CANT_POSSESS_MORE') {
				if (event.message.indexOf('@item:204052') != -1) {
					needToDecompose = false;
					endDecompose();
					switch (config.filetmode) {
						case 'drop':
							needToDropFilets = true;
							timeouts.push(setTimeout(() => {
								getInventory();
							}, 2000));
							break;
						case 'bank':
							needToBankFilets = true;
							timeouts.push(setTimeout(() => {
								getInventory();
							}, 2000));
							break;
						default:
							mod.command.message('Inv full, mod will be disabled');
							enabled = false;
							break;
					}

				}
			}
			if (message.id == 'SMT_NO_ITEM') {
				noItems = true;
				needToDecompose = true;
				requestDecomposition();
			}
			if (message.id == 'SMT_CANNOT_FISHING_NON_AREA') {
				timeouts.push(setTimeout(() => {
					useRod();
				}, 10000));
			}
			if (message.id === 'SMT_YOU_ARE_BUSY') {
				timeouts.push(setTimeout(() => {
					useRod();
				}, rng(5000, 6000)));
			}

		}
	});

	function useRod() {
		if (enabled && rodId != null) {
			if (config.autosalad && fishsalad != null && abnormalityDuration(70261) <= 0 && fishsalad.amount > 0) {
				fishsalad.amount -= 1;
				mod.toServer('C_USE_ITEM', 3, {
					gameId: mod.game.me.gameId,
					id: fishsalad.id,
					dbid: 0,
					target: 0,
					amount: 1,
					dest: 0,
					loc: playerLocation.loc,
					w: playerLocation.w,
					unk1: 0,
					unk2: 0,
					unk3: 0,
					unk4: true
				});
			}
			timeouts.push(setTimeout(() => {
				mod.toServer('C_USE_ITEM', 3, {
					gameId: mod.game.me.gameId,
					id: rodId,
					dbid: 0,
					target: 0,
					amount: 1,
					dest: 0,
					loc: playerLocation.loc,
					w: playerLocation.w,
					unk1: 0,
					unk2: 0,
					unk3: 0,
					unk4: true
				});
			}, 250));
		}
	}

	function useBait() {
		if (enabled && config.bait > 0)
			mod.toServer('C_USE_ITEM', 3, {
				gameId: mod.game.me.gameId,
				id: config.bait,
				dbid: 0,
				target: 0,
				amount: 1,
				dest: 0,
				loc: playerLocation.loc,
				w: playerLocation.w,
				unk1: 0,
				unk2: 0,
				unk3: 0,
				unk4: true
			});
	}
	//endregion

	//region Locations hooks
	mod.hook('C_PLAYER_LOCATION', 5, event => {
		playerLocation = event;
	});
	mod.hook('S_LOAD_TOPO', 3, event => {
		playerLocation.loc = event.loc;
		playerLocation.w = 0;
		if (enabled)
			clearTimeouts();
	});
	mod.hook('C_RETURN_TO_LOBBY', 1, event => {
		if (enabled)
			clearTimeouts();
	});
	mod.hook('S_EXIT', 3, event => {
		if (enabled)
			clearTimeouts();
	});
	//endregion

	//region Contract hooks
	mod.hook('S_REQUEST_CONTRACT', 1, event => {
		if (enabled && mod.game.me.is(event.senderId)) {
			if (event.type == 89 && needToDecompose) {
				ContractId = event.id;
				processDecompositionItem();
			}
			if (event.type == 26 && needToBankFilets) {
				currentBanker.contractId = event.id;
				processBankingFillets();
			}
			if (event.type == 9 && needToSellFishes) {
				currentSeller.contractId = event.id;
				if (invFishes.length == 0) {
					clearTimeout(endSellingTimer);
					endSellingTimer = setTimeout(() => {
						endSelling();
					}, 5000);
				} else {
					processSellingFishes();
				}
			}
		}
	});
	mod.hook('S_CANCEL_CONTRACT', 1, event => {
		if (enabled && mod.game.me.is(event.senderId)) {
			if (event.type == 89 && ContractId == event.id)
				ContractId = null;
			if (event.type == 26 && needToBankFilets && currentBanker.contractId == event.id) {
				currentBanker = null;
				needToBankFilets = false;
				bankerUsed = false;
				timeouts.push(setTimeout(() => {
					useRod();
				}, rng(5000, 6000)));
			}
			if (event.type == 9 && needToSellFishes && currentSeller.contractId == event.id) {
				currentSeller = null;
				needToSellFishes = false;
				sellerUsed = false;
				timeouts.push(setTimeout(() => {
					useRod();
				}, rng(5000, 6000)));
			}
		}
	});
	//endregion

	//region Decompose part
	mod.hook('S_RP_ADD_ITEM_TO_DECOMPOSITION_CONTRACT', 1, event => {
		if (enabled && needToDecompose) {
			decomposeitemscount++;
			if (invFishes.length > 0 && decomposeitemscount < 20) {
				timeouts.push(setTimeout(() => {
					processDecompositionItem();
				}, rng(200,400)));
			} else {
				timeouts.push(setTimeout(() => {
					if (decomposeitemscount > 0)
						commitDecomposition();
				}, 300));
			}
		}
	});

	function requestDecomposition() {
		if (enabled)
			mod.send('C_REQUEST_CONTRACT', 1, {
				type: 89
			});
	}

	function commitDecomposition() {
		if (enabled && ContractId != null) {
			decomposeitemscount = 0;
			mod.send('C_RQ_COMMIT_DECOMPOSITION_CONTRACT', 1, {
				contract: ContractId
			});
			timeouts.push(setTimeout(() => { //reduce opcodes
				endDecompose();
				needToDecompose = false;
				if(needToCraft){
					timeouts.push(setTimeout(() => {
						startCraft();
					}, rng(5000, 6000)));
				}else{
					timeouts.push(setTimeout(() => {
						useRod();
					}, rng(5000, 6000)));
				}
			}, 10000));

		}

	}

	function processDecompositionItem() {
		let newitem = invFishes.shift();
		if (newitem != undefined && ContractId != null && enabled) {
			mod.send('C_RQ_ADD_ITEM_TO_DECOMPOSITION_CONTRACT', 1, {
				contract: ContractId,
				dbid: newitem.dbid,
				itemid: newitem.id,
				amount: 1
			});
		}
	}

	function endDecompose() {
		if (enabled && ContractId != null) {
			noItems = false;
			mod.send('C_CANCEL_CONTRACT', 1, {
				type: 89,
				id: ContractId
			});
		}
	}

	//endregion

	//region Inv part
	mod.hook('S_INVEN', 17, {
		order: -1000,
		filter: {
			fake: null
		},
	}, event => {
		if (!enabled) return;
		if (event.first) {
			if (!needToDecompose && !needToSellFishes)
				invFishes = [];
			findedFillets=null;
		}
		if (!needToDecompose && !needToSellFishes)
			event.items.forEach(function (obj) {
				if (ITEMS_FISHES.includes(obj.id) && !config.blacklist.includes(obj.id)) {
					invFishes.push(obj);
				}
			});
		event.items.forEach(function (obj) {
			if (obj.id == 204052) {
				findedFillets = obj;
			}
		});
		if (config.autosalad)
			event.items.forEach(function (obj) {
				if ([206020, 206040].includes(obj.id)) {
					fishsalad = obj;
				}
			});
		if (needToSellFishes && !sellerUsed) {
			if (config.selltonpc) {
				if (closestSellerNpc == null || closestSellerNpc.loc.dist3D(playerLocation.loc) > config.contdist * 25) {
					mod.command.message('Error: no seller npc at acceptable range');
					enabled = false;
					return;
				}
				sellerUsed = true;
				currentSeller = Object.create(closestSellerNpc);
				timeouts.push(setTimeout(() => {
					mod.send('C_NPC_CONTACT', 2, {
						gameId: currentSeller.gameId
					});
				}, 3000));
			} else {
				for (let seller of event.items) {
					if (ITEMS_SELLER.includes(seller.id)) {
						invSeller = {
							id: seller.id
						};
						sellerUsed = true;
						useSeller();
						break;
					}
				}
			}

		}
		if (findedFillets != null && needToDropFilets && config.filetmode == 'drop' && config.dropAmount > 150) {
			needToDropFilets = false;
			let amount = config.dropAmount > findedFillets.amount ? findedFillets.amount : config.dropAmount;
			amount = findedFillets.amount - amount < 150 ? amount - 150 : amount;
			mod.send('C_DEL_ITEM', 2, {
				gameId: mod.game.me.gameId,
				slot: findedFillets.slot - 40,
				amount: amount
			});
			timeouts.push(setTimeout(() => {
				useRod();
			}, rng(5000, 6000)));
		}
		if (findedFillets != null && needToBankFilets && !bankerUsed && config.filetmode == 'bank' && config.bankAmount > 150) {
			if (pcbangBanker == null) {
				for (let banker of event.items) {
					if (ITEMS_BANKER.includes(banker.id)) {
						invBanker = {
							id: banker.id
						};
						bankerUsed = true;
						useBanker();
						break;
					}
				}
			} else {
				bankerUsed = true;
				useBanker();
			}
		}
	});
	mod.hook('S_PCBANGINVENTORY_DATALIST', 1, event => {
		for (let item of event.inventory) {
			if (ITEMS_BANKER.includes(item.item)) {
				pcbangBanker = {
					slot: item.slot
				};
			}
		}
	});
	mod.hook('S_START_COOLTIME_ITEM', 1, event => {
		if ((ITEMS_BANKER.includes(event.item) || ITEMS_SELLER.includes(event.item)) && event.cooldown > 0 && !scrollsInCooldown) {
			scrollsInCooldown = true;
			setTimeout(() => {
				scrollsInCooldown = false;
			}, event.cooldown * 1000);
		};
	});

	function getInventory() {
		if (enabled)
			mod.send('C_SHOW_INVEN', 1, {
				unk: 1
			});
	}
	//endregion

	//region Other functions
	function rng(min, max) {
		return min + Math.floor(Math.random() * (max - min + 1));
	}

	function getItemIdChatLink(chatLink) {
		let regexId = /#(\d*)@/;
		let id = chatLink.match(regexId);
		if (id) return parseInt(id[1])
		else return null;
	}

	function saveConfig(pathToFile) {
		fs.writeFile(path.join(__dirname, pathToFile), JSON.stringify(config, null, '\t'), err => {});
	}

	function getJsonData(pathToFile) {
		let defaultConfig = null;
		try {
			defaultConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json')));
		} catch (e) {}
		try {
			config = JSON.parse(fs.readFileSync(path.join(__dirname, pathToFile)));
		} catch (e) {
			if (defaultConfig != null) {
				config = defaultConfig;
				console.log("auto-fishing: Default config loaded");
			} else {
				config = {};
				config.delay = 3000;
				config.contdist = 6;
				config.blacklist = [];
			}
		}
		if (!config.delay > 0) {
			config.delay = 3000;
		}
		if (!config.contdist > 0) {
			config.contdist = 6;
		}
		if (config.blacklist === undefined || config.blacklist == null)
			config.blacklist = [];
	}

	function clearTimeouts() {
		for (var i = 0; i < timeouts.length; i++) {
			clearTimeout(timeouts[i]);
			delete timeouts[i];
		}
		clearTimeout(idleCheckTimer);
	}
	this.destructor = () => {
		clearTimeouts();
	};
	//endregion

	//region Crafting
	mod.hook('C_START_PRODUCE', 1, event => {
		lastRecipe = event.recipe;
	});
	mod.hook('S_END_PRODUCE', 1, event => {
		if (enabled && needToCraft)
			if (event.success) {
				timeouts.push(setTimeout(() => {
					startCraft();
				}, 500));
			} else {
				if (!noItems) {
					needToCraft = false;
					timeouts.push(setTimeout(() => {
						useBait();
					}, 500));
					timeouts.push(setTimeout(() => {
						useRod();
					}, rng(5000, 6000)));
				}
					
			}
	})

	function startCraft() {
		if (enabled && config.recipe > 0){
			if(findedFillets==null||findedFillets.amount<30){
				needToDecompose = true;
				requestDecomposition();
			}else{
				mod.send('C_START_PRODUCE', 1, {
					recipe: config.recipe,
					unk: 0
				});
			}
		}
			
	}

	//endregion

	//region NPC
	mod.hook('S_SPAWN_NPC', 11, event => {
		if (event.templateId == 9903 || event.templateId == 9906) {
			closestSellerNpc = event;
		}
		if (enabled) {
			if (needToBankFilets && currentBanker == null) {
				if (event.relation == 12 && event.templateId == 1962 && mod.game.me.is(event.owner)) {
					currentBanker = event;
					timeouts.push(setTimeout(() => {
						mod.send('C_NPC_CONTACT', 2, {
							gameId: currentBanker.gameId
						})
					}, rng(3000,5000)));
				}
			}
			if (needToSellFishes && !config.selltonpc && currentSeller == null) {
				if (event.relation == 12 && (event.templateId == 1960 || event.templateId == 1961) && mod.game.me.is(event.owner)) {
					currentSeller = event;
					timeouts.push(setTimeout(() => {
						mod.send('C_NPC_CONTACT', 2, {
							gameId: currentSeller.gameId
						})
					}, rng(3000,5000)));
				}
			}
		}
	});
	mod.hook('S_DIALOG', 2, event => {

		if (enabled) {
			if (needToBankFilets) {
				if (event.gameId == currentBanker.gameId && event.questId == 1962) {
					currentBanker.dialogId = event.id;
					timeouts.push(setTimeout(() => {
						mod.send('C_DIALOG', 1, {
							id: currentBanker.dialogId,
							index: 1,
							questReward: -1,
							unk: -1
						})
					}, rng(3000,4000)));
				}
			}
			if (needToSellFishes) {
				if (event.gameId == currentSeller.gameId && (event.questId == 1960 || event.questId == 1961 || event.questId == 9903 || event.questId == 9906)) {
					currentSeller.dialogId = event.id;
					timeouts.push(setTimeout(() => {
						mod.send('C_DIALOG', 1, {
							id: currentSeller.dialogId,
							index: 1,
							questReward: -1,
							unk: -1
						})
					}, rng(3000,4000)));
				}
			}
		}
	});
	//region Seller
	mod.tryHook('S_STORE_BASKET', 'raw', _ => {
		if (enabled && needToSellFishes) {
			if (invFishes.length > 0 && sellItemsCount < 7) {
				sellItemsCount++;
				timeouts.push(setTimeout(() => {
					processSellingFishes();
				}, rng(200,300)));
				if (invFishes.length < 8) {
					clearTimeout(endSellingTimer);
					endSellingTimer = setTimeout(() => {
						endSelling();
					}, 10000);
				}
			} else {
				timeouts.push(setTimeout(() => {
					if (sellItemsCount > 0)
						sellFishes();
					else {
						clearTimeout(endSellingTimer);
						endSellingTimer = setTimeout(() => {
							endSelling();
						}, 1000);
					}
				}, 300));
			}
		}
	});

	function sellFishes() {
		if (enabled) {
			sellItemsCount = 0;
			mod.send('C_STORE_COMMIT', 1, {
				gameId: mod.game.me.gameId,
				npc: currentSeller.contractId
			});
		}
	}

	function endSelling() {
		if (enabled) {
			mod.send('C_CANCEL_CONTRACT', 1, {
				type: 9,
				id: currentSeller.contractId
			});
		}
	}

	function useSeller() {
		if (!enabled) return;
		if (scrollsInCooldown) {
			console.log("Seller in cooldown retry in 1 min");
			timeouts.push(setTimeout(() => {
				useSeller();
			}, 60 * 1000));
			return;
		}
		if (invSeller != null) {
			mod.send('C_USE_ITEM', 3, {
				gameId: mod.game.me.gameId,
				id: invSeller.id,
				dbid: invSeller.dbid,
				target: 0,
				amount: 1,
				dest: 0,
				loc: playerLocation.loc,
				w: playerLocation.w,
				unk1: 0,
				unk2: 0,
				unk3: 0,
				unk4: true
			});
		} else {
			console.log("No seller found, disabling mod");
			enabled = false;
		}
	}

	function processSellingFishes() {
		let newitem = invFishes.shift();
		if (newitem != undefined && currentSeller != null && enabled) {
			mod.send('C_STORE_SELL_ADD_BASKET', 1, {
				cid: mod.game.me.gameId,
				npc: currentSeller.contractId,
				item: newitem.id,
				quantity: 1,
				slot: newitem.slot
			});
		} else {
			clearTimeout(endSellingTimer);
			endSellingTimer = setTimeout(() => {
				endSelling();
			}, 1000);
		}
	}
	//endregion

	//region Banker
	function useBanker() {
		if (!enabled) return;
		if (scrollsInCooldown) {
			console.log("Banker in cooldown retry in 1 min");
			timeouts.push(setTimeout(() => {
				useBanker();
			}, 60 * 1000));
			return;
		}
		if (pcbangBanker != null) {
			mod.send('C_PCBANGINVENTORY_USE_SLOT', 1, pcbangBanker);
		} else
		if (invBanker != null) {
			mod.send('C_USE_ITEM', 3, {
				gameId: mod.game.me.gameId,
				id: invBanker.id,
				dbid: invBanker.dbid,
				target: 0,
				amount: 1,
				dest: 0,
				loc: playerLocation.loc,
				w: playerLocation.w,
				unk1: 0,
				unk2: 0,
				unk3: 0,
				unk4: true
			});
		} else {
			console.log("No banker found, disabling mod");
			enabled = false;
		}
	}

	function processBankingFillets() {
		if (!enabled) return;
		if (findedFillets != null) {
			let amount = config.bankAmount > findedFillets.amount ? findedFillets.amount : config.bankAmount;
			amount = findedFillets.amount - amount < 150 ? amount - 150 : amount;
			mod.send('C_PUT_WARE_ITEM', 2, {
				gameId: mod.game.me.gameId,
				type: 1,
				page: 0,
				money: 0n,
				invenPos: findedFillets.slot, //actually ignored
				dbid: findedFillets.id,
				uid: findedFillets.dbid,
				amont: amount,
				bankPos: 0
			});
			timeouts.push(setTimeout(() => {
				mod.send('C_CANCEL_CONTRACT', 1, {
					type: 26,
					id: currentBanker.contractId
				});
			}, 5000));
		}
	}
	//endregion

	//endregion

	//region Abnormality tracking
	let abnormalities = {};
	mod.hook('S_ABNORMALITY_BEGIN', 3, event => {
		if (mod.game.me.is(event.target))
			abnormalities[event.id] = Date.now() + event.duration;
	});

	mod.hook('S_ABNORMALITY_REFRESH', 1, event => {
		if (mod.game.me.is(event.target))
			abnormalities[event.id] = Date.now() + event.duration;
	});

	mod.hook('S_ABNORMALITY_END', 1, event => {
		if (mod.game.me.is(event.target))
			delete abnormalities[event.id];
	});

	function abnormalityDuration(id) {
		if (!abnormalities[id])
			return 0;
		return abnormalities[id] - Date.now();
	}
	//endregion

	//region Command
	mod.command.add('fish', (key, arg, arg2) => {
		switch (key) {
			case 'blacklist':
				switch (arg) {
					case 'add':
						var tmp = getItemIdChatLink(arg2);
						if (tmp != null) {
							if (config.blacklist.indexOf(tmp) == -1) {
								mod.command.message(`Pushed item id to blacklist: ${tmp}`);
								config.blacklist.push(tmp);
							} else {
								mod.command.message(`Already exist`);
							}

						} else {
							mod.command.message(`Incorrect item id`);
						}

						break;
					case 'remove':
						var tmp = getItemIdChatLink(arg2);
						if (tmp != null) {
							var index = config.blacklist.indexOf(tmp);
							if (index == -1) {
								mod.command.message(`not exist`);
							} else {
								mod.command.message(`Remove item id from blacklist: ${tmp}`);
								config.blacklist.splice(index, 1);
							}
						} else {
							mod.command.message(`Incorrect item id`);
						}
						break;
					case 'reset':
						config.blacklist = [];
						mod.command.message(`Blacklist reset`);
						break;
				}
				break;

			case 'setbait':
				var tmp = getItemIdChatLink(arg);
				if (tmp != null) {
					mod.command.message(`Bait id set to: ${tmp}`);
					config.bait = tmp;
				} else {
					mod.command.message(`Incorrect item id`);
				}
				break;
			case 'filetmode':
				switch (arg) {
					case 'drop':
						var amount = parseInt(arg2);
						if (amount > 500 && amount < 10000) {
							config.dropAmount = amount;
							mod.command.message(`Set to drop ${config.dropAmount} files after filling inventory`);
						} else {
							config.dropAmount = 2000;
							mod.command.message(`Set to drop ${config.dropAmount} files after filling inventory`);
						}
						config.filetmode = 'drop';
						break;
					case 'bank':
						var amount = parseInt(arg2);
						if (amount > 500 && amount < 10000) {
							config.bankAmount = amount;
							mod.command.message(`Set to bank ${config.bankAmount} files after filling inventory`);
						} else {
							config.bankAmount = 2000;
							mod.command.message(`Set to bank ${config.bankAmount} files after filling inventory`);
						}
						config.filetmode = 'bank';
						if (config.filetmode == 'bank' && Object.values(extendedFunctions.banker).some(x => !x)) {
							config.filetmode = false;
							mod.command.message('C_PUT_WARE_ITEM not mapped, banker functions for auto-fishing will be disabled!');
						}
						break;
					default:
						mod.command.message(`filetmode disabled`);
						config.filetmode = false;
						break;
				}
				break;
			case 'setrecipe':
				if (lastRecipe != null) {
					mod.command.message(`Recipe id set to: ${lastRecipe}`);
					config.recipe = lastRecipe;
				} else {
					mod.command.message(`Incorrect item id. Manually craft bait when mod enabled`);
				}
				break;
			case 'setdelay':
				var delay = parseInt(arg);
				if (delay > 0) {
					config.delay = delay;
					mod.command.message(`Delay for minigame set to: ${arg}`);
				} else {
					mod.command.message(`Incorrect value`);
				}
				break;
			case 'sellfishes':
				mod.command.message(`Set to sell fishes after filling inventory`);
				config.filetmode = 'sellfishes';
				if (config.filetmode == 'sellfishes' && Object.values(extendedFunctions.seller).some(x => !x)) {
					config.filetmode = false;
					mod.command.message('C_STORE_SELL_ADD_BASKET|S_STORE_BASKET|C_STORE_COMMIT not mapped, seller functions will be disabled!');
				}
				break;
			case 'selltonpc':
				config.selltonpc = !config.selltonpc;
				mod.command.message(`Sell to npc instead using scrolls ${config.selltonpc?'en':'dis'}abled.`);
				var dist = parseInt(arg);
				if (dist > 0) {
					if (dist > 10)
						dist = 6;
					config.contdist = dist;
					mod.command.message(`Distance for NPC contact set to: ${dist}m`);
				}
				if (config.selltonpc) {
					if (closestSellerNpc == null || closestSellerNpc.loc.dist3D(playerLocation.loc) > config.contdist * 25) {
						mod.command.message('Warning: no seller npc at acceptable range');
					}
				}
				break;
			case 'autosalad':
				config.autosalad = !config.autosalad;
				mod.command.message('Auto use of Fish Salad ' + (config.autosalad ? 'en' : 'dis') + 'abled');
				break;
			case 'save':
				mod.command.message(`Configuration saved`);
				saveConfig(settingsPath);
				break;
			case 'reloadconf':
				getJsonData(settingsPath);
				mod.command.message(`Configuration reloaded`);
				break;
			case 'stats':
				var gr = statistic.reduce((acc, val) => {
					(acc[val['level']] = acc[val['level']] || []).push(val);
					return acc;
				}, {});
				mod.command.message(`Printing stats.`);
				for (var lv in gr) {
					mod.command.message(`${lv} level:${gr[lv].length}`);
				}
				var timePerFish = statistic.reduce((prev, next) => prev + next.time, 0) / statistic.length;
				mod.command.message(`Total fishes: ${statistic.length}`);
				mod.command.message(`Time per fish: ${(timePerFish/1000).toFixed(2)}s`);
				break;
			case 'printdebug':
				console.log(`Debug log`);
				console.log(`bankerUsed=${bankerUsed}`);
				console.log(`sellerUsed=${sellerUsed}`);
				console.log(`scrollsInCooldown=${scrollsInCooldown}`);
				console.log(`noItems=${noItems}`);
				console.log(`needToDecompose=${needToDecompose}`);
				console.log(`needToBankFilets=${needToBankFilets}`);
				console.log(`needToSellFishes=${needToSellFishes}`);
				console.log(`needToCraft=${needToCraft}`);
				console.log(`needToDropFilets=${needToDropFilets}`);
				console.log(`invFishes count=${invFishes.length}`);
				console.log(`sellItemsCount=${sellItemsCount}`);
				break;
			default:
				enabled = !enabled;
				rodId = null,
					ContractId = null,
					needToCraft = false,
					needToDecompose = false,
					needToDropFilets = false,
					needToBankFilets = false,
					needToSellFishes = false,
					noItems = false,
					invFishes = [],
					decomposeitemscount = 0,
					sellItemsCount = 0,
					lastRecipe = null,
					invBanker = null,
					scrollsInCooldown = false,
					invSeller = null,
					currentBanker = null,
					currentSeller = null,
					bankerUsed = false,
					sellerUsed = false,
					findedFillets = null,
					fishsalad = null,
					endSellingTimer = null;
				clearTimeouts();
				if (config.selltonpc) {
					if (closestSellerNpc == null || closestSellerNpc.loc.dist3D(playerLocation.loc) > config.contdist * 25) {
						mod.command.message('Warning: no seller npc at acceptable range');
					}
				}
				if (enabled) {
					statistic = [], startTime = null, endTime = null, lastLevel = null;
					mod.command.message('autoFishing on. Manually start fishing');
					getInventory();
				} else {
					mod.command.message('autoFishing off');
				}
				break;
		}
	});
	//endregion
};