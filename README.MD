#### About
Tera proxy mod for fishing.<br>
#### Installation&updates
Move defs to node_modules\tera-data\protocol.<br>
Move\merge protocol files to node_modules\tera-data\map in Caali proxy.<br>
#### Commands
| Command  | Description | Hint
| ------------- | ------------- | ------------- |
| fish | to enable mod  |  |
| fish sellfishes | Sell fishes when inv full | You need traveling merchant scroll in inventory and additional opcodes&defs |
| fish selltonpc `range` | Option for `fish sellfishes` | Sell to Fishing Supplie. `range` is distance in meters for npc contact, ethical is 6m.|
| fish autosalad | to enable auto using fish salad  |  |
| fish blacklist add link | add item to blacklist for auto decompose  | link from inventory. Blacklist means, that you don't want this fishes be dismantled |
| fish blacklist remove link | remove item from blacklist for auto decompose  |  link from inventory |
| fish blacklist reset | reset blacklist |   |
| fish setrecipe | to set last used recipe for crafting  | enable mod before crafting  |
| fish setbait link | to set bait |  link from inventory  |
| fish save | to save settings  |   |
| fish setdelay value | set delay for ending minigame  |   |
| fish filetmode drop value | Set value to drop fish files after filling inventory  | value range is 500-10000   |
| fish filetmode | disable any interactions with fillets  |   |
| fish filetmode bank value | Set value to bank fish files after filling inventory | value range is 500-10000. You need banker scroll in vip panel or inventory |


You can manually edit config file<br>
Repo will contains opcodes only for RU, unless someone send me them for other regions. Use [Find packet id](https://github.com/Owyn/alex-packet-id-finder) / [PacketsLogger](https://github.com/SoliaRdi/PacketsLogger)<br>
