const path = require('path');
const fs = require('fs');
module.exports = function autoFishing(mod) {
	let itemids=[],
	rodId=null,
	enabled=false,
	playerLocation,
	ContractId=null,
	needToCraft=false,
	needToDecompose=false,
	invitems=[],
	decomposeitemscount=0,
	lastRecipe=null;
	
	let config;
    try {
        config = require('./config.json');
		if(!config.delay>0){
			config.delay=2000;
		}
    } catch (error) {
        config = {};
		config.delay=2000;
    }
	
	
	mod.game.initialize(['me', 'contract']);
	/*mod.hook('C_CAST_FISHING_ROD', 1, event => {
		if(enabled){
			console.log('C_CAST_FISHING_ROD');
			rodId=event.rodId;
		}
	})*/
	mod.hook('S_FISHING_BITE', 1, event => {
		if(enabled&&mod.game.me.is(event.gameId)){
			rodId=event.rodId;
			setTimeout(() => {
				mod.send('C_START_FISHING_MINIGAME',1,{});
			}, 1000);
		}
	})
	mod.hook('S_START_FISHING_MINIGAME', 1, event => {
		if(enabled&&mod.game.me.is(event.gameId)){
			setTimeout(() => {
				mod.send('C_END_FISHING_MINIGAME',1,{success:true});
			},config.delay+event.level*50);
		}
	})
	mod.hook('S_FISHING_CATCH', 1, event => {
		if(enabled&&mod.game.me.is(event.gameId)){
			setTimeout(() => {
				useRod();
			}, 5000);
		}
	})
	mod.hook('S_FISHING_CATCH_FAIL', 1, event => {
		if(enabled&&mod.game.me.is(event.gameId)){
			console.log('S_FISHING_CATCH_FAIL');
			setTimeout(() => {
				useRod();
			}, 5000);
		}
	})
	mod.hook('C_PLAYER_LOCATION', 5, event => {
		playerLocation = event;
	});
	//decompose part
	mod.hook('S_REQUEST_CONTRACT', 1, event => {
		if(enabled&&mod.game.me.is(event.senderId)){
			if(event.type==89&&needToDecompose){
				ContractId=event.id;
				processDecompositionItem();
			}
				
		}
	});
	mod.hook('S_CANCEL_CONTRACT', 1, event => {
		if(enabled&&mod.game.me.is(event.senderId)){
			if(event.type==89&&ContractId==event.id)
				ContractId=null;
		}
	});
	mod.hook('S_RP_ADD_ITEM_TO_DECOMPOSITION_CONTRACT', 1, raw => {
		if(enabled&&needToDecompose){
			decomposeitemscount++;
			if(invitems.length>0&&decomposeitemscount<=20){
				setTimeout(() => {
					processDecompositionItem();
				}, 150);
				
			}else{
				setTimeout(() => {
					if(decomposeitemscount>0)
						decompose();
				}, 200);
			}
		}
	});
	mod.hook('S_INVEN', 16,{order:-1000}, event => {
		if(enabled&&config.items!==undefined&&event.items.length>0){
			event.items.forEach(function(obj) {
				if(config.items.includes(obj.id)){
					let index = invitems.findIndex(x => x.dbid==obj.dbid);
					if (index == -1&&obj.dbid!=0){
						invitems.push(obj);
					}
				}
			});
		}
	});
	mod.hook('S_SYSTEM_MESSAGE_LOOT_ITEM', 1, event => {
		if(enabled&&config.items!==undefined){
			if(config.items.includes(event.item)){
				let index = invitems.findIndex(x => x.dbid==event.unk2);
				if (index == -1){
					invitems.push({
						id:event.item,
						dbid:BigInt(event.unk2)
					});
				}
			}
		}
	});
	mod.hook('S_RP_COMMIT_DECOMPOSITION_CONTRACT', 'raw', _ => {
		if(enabled&&needToDecompose){
			decomposeitemscount=0;
			endDecompose();
			needToDecompose=false;
			setTimeout(() => {
				useRod();
			}, 2000);
		}
	});
	function requestDecomposition(){
		mod.send('C_REQUEST_CONTRACT', 1, { type: 89 });
	}
	function decompose(){
		if(ContractId!=null)
			mod.send('C_RQ_COMMIT_DECOMPOSITION_CONTRACT', 1, { contract: ContractId });
	}
	function processDecompositionItem(){
		let current=invitems.shift();
		if(current!=undefined&&ContractId!=null&&enabled){
			mod.send('C_RQ_ADD_ITEM_TO_DECOMPOSITION_CONTRACT', 1, {
				contract:ContractId,
				dbid:current.dbid,
				itemid:current.id,
				amount:1
			});
		}
	}
	function endDecompose(){
		if(ContractId!=null)
			mod.send('C_CANCEL_CONTRACT', 1, { type:89,id:ContractId });
	}
	//end decompose part
	mod.hook('S_SYSTEM_MESSAGE', 1, event => {
		if(enabled){
			if(event.message.indexOf('@4121')!=-1){//craft and use baits
				startCraft();
			}
			if(event.message.indexOf('@4123')!=-1){//need to decompose
				needToDecompose=true;
				requestDecomposition();
			}
			if(event.message.indexOf('@3117')!=-1){//full decomposition list
				
			}
			if(event.message.startsWith('@40')&&event.message.indexOf(config.recipe)!=-1){

			}
		}
	});
	//craft part
	mod.hook('C_START_PRODUCE', 1, event => {
		if(enabled){
			lastRecipe=event.recipe;
		}
	});
	mod.hook('S_END_PRODUCE', 1, event => {
		if(enabled&&event.success){
			setTimeout(() => {
					startCraft();
			}, 500);
		}else{
			setTimeout(() => {
				useBait();
			}, 500);
			setTimeout(() => {
				useRod();
			}, 2000);
		}
	});
	function startCraft(){
		if(config.recipe>0)
			mod.send('C_START_PRODUCE', 1, { recipe:config.recipe,unk:0 });
	}
	//end craft part
	function useRod() {//@4121 need bait error sysmsg @4123 - full inv msg|| @3117 - full decomposition list
		if(enabled&&playerLocation!=undefined&&playerLocation.loc!=undefined&&rodId!=null)
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
	};
	function useBait() {//4121 error sysmsg
		if(enabled&&playerLocation!=undefined&&playerLocation.loc!=undefined&&config.bait>0)
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
	};
	function getItemIdChatLink(chatLink) {
        let regexId = /#(\d*)@/;
        let id = chatLink.match(regexId);
        if (id) return parseInt(id[1])
        else return null;
    }
	 function saveConfig() {
        fs.writeFile(path.join(__dirname, 'config.json'), JSON.stringify(config, null, '\t'), err => { });
    }
	mod.command.add('fish',(key,link)=>{
		switch (key) {
			case 'add':
				if(config.items===undefined||config.items==null)
					config.items=[];
				var tmp=getItemIdChatLink(link);
				if(tmp!=null){
					if(config.items.indexOf(tmp)==-1){
						mod.command.message(`Pushed item id: ${tmp}`);
						config.items.push(tmp);
					}else{
						mod.command.message(`Already exist`);
					}
					
				}else{
					mod.command.message(`Incorrect item id`);
				}
				
			break;
			case 'remove':
				if(config.items===undefined||config.items==null)
					config.items=[];
				var tmp=getItemIdChatLink(link);
				if(tmp!=null){
					var index=config.items.indexOf(tmp);
					if(index==-1){
						mod.command.message(`not exist`);
					}else{
						mod.command.message(`Remove item id: ${tmp}`);
						config.items.splice(index, 1);
					}
				}else{
					mod.command.message(`Incorrect item id`);
				}
			break;
			case 'setbait':
				var tmp=getItemIdChatLink(link);
				if(tmp!=null){
					mod.command.message(`Bait id set to: ${tmp}`);
					config.bait=tmp;
				}else{
					mod.command.message(`Incorrect item id`);
				}
			break;
			case 'setrecipe':
				if(lastRecipe!=null){
					mod.command.message(`Recipe id set to: ${lastRecipe}`);
					config.recipe=lastRecipe;
				}else{
					mod.command.message(`Incorrect item id`);
				}
			break;
			case 'setdelay':
				var delay=parseInt(link);
				if (delay>0) {
					config.delay=delay;
					mod.command.message(`Delay for minigame set to: ${link}`);
				}else{
					mod.command.message(`Incorrect value`);
				}
			break;
			case 'test':
				requestDecomposition();
				needToDecompose=true;
			break;
			case 'save':
				saveConfig();
			break;
			default:
				enabled=!enabled;
				if (enabled)
					mod.command.message('autoFishing on. Manually start fishing');
				else{
					rodId=null;
					mod.command.message('autoFishing off');
				}
			break;
		}
	})
};