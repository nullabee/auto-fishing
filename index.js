const path = require('path');
const fs = require('fs');
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
const ITEMS_BANKER = [60264, 160326, 170003, 216754];
const ITEMS_SELLER = [160324, 170004, 210109, 60262];
module.exports = function autoFishing(mod) {
	let rodId = null,
		enabled = false,
		playerLocation,
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
		currentFish,
		pcbangBanker = null,
		invBanker = null,
		scrollsInCooldown = false,
		invSeller = null,
		currentBanker = null,
		currentSeller = null,
		bankerUsed = false,
		sellerUsed = false,
		findedFillets = null,
		fishsalad = null;
		let extendedFunctions = {
		banker:{
			'C_PUT_WARE_ITEM': false,
		},
		seller:{
			'C_STORE_SELL_ADD_BASKET': false,
			'S_STORE_BASKET': false,
			'C_STORE_COMMIT': false,
		}
	};

	let config;
	try {
		config = require('./config.json');
		if (!config.delay > 0) {
			config.delay = 3000;
		}
		if (config.blacklist === undefined || config.blacklist == null)
			config.blacklist = [];
	} catch (error) {
		config = {};
		config.delay = 3000;
		config.blacklist = [];
	}

	//region Checks
	mod.game.initialize(['me']);
	mod.game.on('enter_game', () => {
		for (var type in extendedFunctions) {
			for(var opcode in type){
				var test = mod.dispatch.protocolMap.code.get(type[opcode]);
				if (test !== undefined && test != null) type[opcode] = true;
			}
		}
		if (config.filetmode == 'bank' &&Object.values(extendedFunctions.banker).some(x=>!x)) {
			config.filetmode = false;
			mod.command.message('C_PUT_WARE_ITEM not mapped, banker functions will be disabled!');
		}
		if (config.filetmode == 'sellfishes' && Object.values(extendedFunctions.seller).some(x=>!x)) {
			config.filetmode = false;
			mod.command.message('C_STORE_SELL_ADD_BASKET|S_STORE_BASKET|C_STORE_COMMIT not mapped, seller functions will be disabled!');
		}
	});
	//endregion

	//region Fishing

	mod.hook('S_FISHING_BITE', 1, event => {
		if (enabled && mod.game.me.is(event.gameId)) {
			noItems = false;
			rodId = event.rodId;
			setTimeout(() => {
				mod.send('C_START_FISHING_MINIGAME', 1, {});
			}, rng(1000, 2000));
		}
	})

	mod.hook('S_START_FISHING_MINIGAME', 1, event => {
		if (enabled && mod.game.me.is(event.gameId)) {
			setTimeout(() => {
				mod.send('C_END_FISHING_MINIGAME', 1, {
					success: true
				});
			}, rng(config.delay, config.delay + 1000) + event.level * 50);
		}
	})
	mod.hook('S_FISHING_CATCH', 1, event => {
		if (enabled && mod.game.me.is(event.gameId)) {
			setTimeout(() => {
				useRod();
			}, rng(5000, 6000));
		}
	})
	mod.hook('S_FISHING_CATCH_FAIL', 1, event => {
		if (enabled && mod.game.me.is(event.gameId)) {
			console.log('S_FISHING_CATCH_FAIL');
			setTimeout(() => {
				useRod();
			}, rng(5000, 6000));
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
					setTimeout(() => {
						getInventory();
					}, 2000);
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
							setTimeout(() => {
								getInventory();
							}, 2000);
							break;
						case 'bank':
							needToBankFilets = true;
							setTimeout(() => {
								getInventory();
							}, 2000);
							break;
						default:
							console.log('Inv full, mod will be disabled');
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
				setTimeout(() => {
					useRod();
				}, 10000);
			}
			if (message.id === 'SMT_YOU_ARE_BUSY') {
				setTimeout(() => {
					useRod();
				}, rng(5000, 6000));
			}

		}
	});

	function useRod() {
		if (enabled && playerLocation != undefined && rodId != null) {
			if (config.autosalad && fishsalad != null && abnormalityDuration(70261) == 0 && fishsalad.amount > 0) {
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
			setTimeout(() => {
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
			}, 500);
		}


	}

	function useBait() {
		if (enabled && playerLocation != undefined && config.bait > 0)
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
		if ([0, 1, 5, 6].indexOf(event.type) > -1)
			playerLocation = event;
	});
	mod.hook('C_USE_ITEM', 3, event => {
		if (enabled && playerLocation == undefined) {
			playerLocation = {
				loc: event.loc,
				w: event.w
			};
		}

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
				processSellingFishes();
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
				setTimeout(() => {
					useRod();
				}, rng(5000, 6000));
			}
			if (event.type == 9 && needToSellFishes && currentSeller.contractId == event.id) {
				currentSeller = null;
				needToSellFishes = false;
				sellerUsed = false;
				setTimeout(() => {
					useRod();
				}, rng(5000, 6000));
			}
		}
	});
	//endregion

	//region Decompose part
	mod.hook('S_RP_ADD_ITEM_TO_DECOMPOSITION_CONTRACT', 1, event => {
		if (enabled && needToDecompose) {
			decomposeitemscount++;
			if (invFishes.length > 0 && decomposeitemscount < 20) {
				setTimeout(() => {
					processDecompositionItem();
				}, 200);
			} else {
				setTimeout(() => {
					if (decomposeitemscount > 0)
						decompose();
				}, 300);
			}
		}
	});
	mod.hook('S_RP_COMMIT_DECOMPOSITION_CONTRACT', 'raw', _ => {
		if (enabled && needToDecompose) {
			endDecompose();
			needToDecompose = false;
			setTimeout(() => {
				useRod();
			}, rng(5000, 6000));
		}
	});

	function requestDecomposition() {
		mod.send('C_REQUEST_CONTRACT', 1, {
			type: 89
		});
	}

	function decompose() {
		if (ContractId != null) {
			decomposeitemscount = 0;
			mod.send('C_RQ_COMMIT_DECOMPOSITION_CONTRACT', 1, {
				contract: ContractId
			});
		}

	}

	function processDecompositionItem() {
		let newitem = invFishes.shift();
		if (currentFish != undefined && newitem != undefined && newitem.dbid == currentFish.dbid)
			return processDecompositionItem();
		currentFish = newitem;
		if (currentFish != undefined && ContractId != null && enabled) {
			mod.send('C_RQ_ADD_ITEM_TO_DECOMPOSITION_CONTRACT', 1, {
				contract: ContractId,
				dbid: currentFish.dbid,
				itemid: currentFish.id,
				amount: 1
			});
		}
	}

	function endDecompose() {
		if (ContractId != null) {
			noItems = false;
			mod.send('C_CANCEL_CONTRACT', 1, {
				type: 89,
				id: ContractId
			});
		}
	}

	//endregion

	//region Inv part
	mod.hook('S_INVEN', 16, {
		order: -1000
	}, event => {
		if (!enabled || event.items.length == 0) return;
		event.items.forEach(function (obj) {
			if (ITEMS_FISHES.includes(obj.id) && !config.blacklist.includes(obj.id)) {
				let index = invFishes.findIndex(x => x.dbid == obj.dbid);
				if (index == -1 && obj.dbid != 0) {
					invFishes.push(obj);
				}
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
		if (needToSellFishes&&!sellerUsed) {
			event.items.forEach(function (obj) {
				if (ITEMS_SELLER.includes(obj.id)) {
					invSeller = {
						id: obj.id
					};
					sellerUsed = true;
					useSeller();
				}
			});
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
			setTimeout(() => {
				useRod();
			}, rng(5000, 6000));
		}
		if (findedFillets != null && needToBankFilets && !bankerUsed && config.filetmode == 'bank' && config.bankAmount > 150) {
			if (pcbangBanker == null) {
				event.items.forEach(function (obj) {
					if (ITEMS_BANKER.includes(obj.id)) {
						invBanker = {
							id: obj.id
						};
						bankerUsed = true;
						useBanker();
					}
				});
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
		if (ITEMS_BANKER.includes(event.item) && event.cooldown > 0 && !scrollsInCooldown) {
			scrollsInCooldown = true;
			setTimeout(() => {
				scrollsInCooldown = false;
			}, event.cooldown * 1000);
		};
	});

	function getInventory() {
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

	function saveConfig() {
		fs.writeFile(path.join(__dirname, 'config.json'), JSON.stringify(config, null, '\t'), err => {});
	}
	//endregion

	//region Crafting
	mod.hook('C_START_PRODUCE', 1, event => {
		lastRecipe = event.recipe;
	});
	mod.hook('S_END_PRODUCE', 1, event => {
		if (enabled && needToCraft)
			if (event.success) {
				setTimeout(() => {
					startCraft();
				}, 500);
			} else {
				if (!noItems) {
					needToCraft = false;
					setTimeout(() => {
						useBait();
					}, 500);
					setTimeout(() => {
						useRod();
					}, rng(5000, 6000));
				}
			}
	});


	function startCraft() {
		if (config.recipe > 0)
			mod.send('C_START_PRODUCE', 1, {
				recipe: config.recipe,
				unk: 0
			});
	}

	//endregion

	//region NPC
	mod.hook('S_SPAWN_NPC', mod.majorPatchVersion >= 79 ? 11 : 10, event => {
		if (enabled) {
			if (needToBankFilets && currentBanker == null) {
				if (event.relation == 12 && event.templateId == 1962 && mod.game.me.is(event.owner)) {
					currentBanker = event;
					setTimeout(() => {
						mod.send('C_NPC_CONTACT', 2, {
							gameId: currentBanker.gameId
						})
					}, 3000);
				}
			}
			if (needToSellFishes && currentSeller == null) {
				if (event.relation == 12 && event.templateId == 1960 && mod.game.me.is(event.owner)) {
					currentSeller = event;
					setTimeout(() => {
						mod.send('C_NPC_CONTACT', 2, {
							gameId: currentSeller.gameId
						})
					}, 3000);
				}
			}
		}
	});
	mod.hook('S_DIALOG', 2, event => {
		if (enabled) {
			if (needToBankFilets) {
				if (event.gameId == currentBanker.gameId && event.questId == 1962) {
					currentBanker.dialogId = event.id;
					setTimeout(() => {
						mod.send('C_DIALOG', 1, {
							id: currentBanker.dialogId,
							index: 1,
							questReward: -1,
							unk: -1
						})
					}, 3000);
				}
			}
			if(needToSellFishes){
				if (event.gameId == currentSeller.gameId && event.questId == 1960) {
					currentSeller.dialogId = event.id;
					setTimeout(() => {
						mod.send('C_DIALOG', 1, {
							id: currentSeller.dialogId,
							index: 1,
							questReward: -1,
							unk: -1
						})
					}, 3000);
				}
			}
		}
	});
	//region Seller
	mod.tryHook('S_STORE_BASKET', 'raw', _ => {
		if (enabled&&needToSellFishes) {
			if (invFishes.length > 0 && sellItemsCount < 7) {
				sellItemsCount++;
				setTimeout(() => {
					processSellingFishes();
				}, 200);
			} else {
				setTimeout(() => {
					if (sellItemsCount > 0)
						sellFishes();
				}, 300);
			}
		}
	});
	mod.hook('S_ACCEPT_CONTRACT', 1, event => {
		if (enabled&&needToSellFishes&&event.type==9&&event.id==currentSeller.contractId&&invFishes.length==0) {
			setTimeout(() => {
					endSelling();
			}, 300);
		}
	});
	function sellFishes(){
		sellItemsCount=0;
		mod.send('C_STORE_COMMIT', 1, {
			gameId: mod.game.me.gameId,
			npc: currentSeller.contractId
		});
	}
	function endSelling(){
			mod.send('C_CANCEL_CONTRACT', 1, {
				type: 9,
				id: currentSeller.contractId
			});
	}
	function useSeller() {
		if (scrollsInCooldown) {
			console.log("Seller in cooldown retry in 1 min");
			setTimeout(() => {
				useSeller();
			}, 60 * 1000);
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
	function processSellingFishes(){
		let newitem = invFishes.shift();
		if (currentFish != undefined && newitem != undefined && newitem.dbid == currentFish.dbid)
			return processSellingFishes();
		currentFish = newitem;
		if (currentFish != undefined&&currentSeller!=null && enabled) {
			mod.send('C_STORE_SELL_ADD_BASKET', 1, {
				cid: mod.game.me.gameId,
				npc: currentSeller.contractId,
				item: currentFish.id,
				quantity: 1,
				slot:currentFish.slot
			});
		}
	}
	//endregion

	//region Banker
	function useBanker() {
		if (scrollsInCooldown) {
			console.log("Banker in cooldown retry in 1 min");
			setTimeout(() => {
				useBanker();
			}, 60 * 1000);
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
			setTimeout(() => {
				mod.send('C_CANCEL_CONTRACT', 1, {
					type: 26,
					id: currentBanker.contractId
				});
			}, 5000);
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
							mod.command.message(`Set to drop ${amount} files after filling inventory`);
						} else {
							config.dropAmount = 2000;
							mod.command.message(`Incorrect value,set to drop ${config.dropAmount} files after filling inventory`);
						}
						config.filetmode = 'drop';
						break;
					case 'bank':
						var amount = parseInt(arg2);
						if (amount > 500 && amount < 10000) {
							config.bankAmount = amount;
							mod.command.message(`Set to bank ${amount} files after filling inventory`);
						} else {
							config.bankAmount = 2000;
							mod.command.message(`Incorrect value,set to bank ${config.bankAmount} files after filling inventory`);
						}
						config.filetmode = 'bank';
						if (config.filetmode == 'bank' &&Object.values(extendedFunctions.banker).some(x=>!x)) {
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
				if (config.filetmode == 'sellfishes' && Object.values(extendedFunctions.seller).some(x=>!x)) {
					config.filetmode = false;
					mod.command.message('C_STORE_SELL_ADD_BASKET|S_STORE_BASKET|C_STORE_COMMIT not mapped, seller functions will be disabled!');
				}
				break;
			case 'autosalad':
				config.autosalad = !config.autosalad;
				mod.command.message('Auto use of Fish Salad ' + (config.autosalad ? 'en' : 'dis') + 'abled');
				break;
			case 'save':
				mod.command.message(`Configuration saved`);
				saveConfig();
				break;
			default:
				enabled = !enabled;
				invFishes = [];
				if (enabled)
					mod.command.message('autoFishing on. Manually start fishing');
				else {
					rodId = null;
					mod.command.message('autoFishing off');
				}
				break;
		}
	});
	//endregion
};