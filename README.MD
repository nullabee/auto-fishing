#### About
Tera proxy mod for fishing.<br>
#### Installation&updates
Move defs to node_modules\tera-data\protocol.<br>
Move\merge protocol files to node_modules\tera-data\map in Caali proxy.<br>
#### Commands
You can edit delays settings from notepad, make fish save once for new options appear.

| Command  | Description | Hint
| ------------- | ------------- | ------------- |
| fish | to enable mod  |  |
| fish stats| print current fishing statistic  |  |
| fish sellscroll | Sell fishes when inv full | You need traveling merchant scroll in inventory and additional opcodes&defs |
| fish selltonpc `range` | Option for `fish sellfishes` | Sell to Fishing Supplie. `range` is distance in meters for npc contact, default is 6m.|
| fish autosalad | to enable auto using fish salad  |  |
| fish blacklist add link | add item to blacklist for auto decompose or selling | link from inventory. Blacklist means, that you don't want this fishes be dismantled or sold |
| fish blacklist remove link | remove item from blacklist |  link from inventory |
| fish blacklist reset | reset blacklist |   |
| fish setrecipe | to set last used recipe for crafting  | enable mod before crafting  |
| fish save | to save settings  | Config file generates per character. |
| fish reloadconf | to reload settings file |  |
| fish filetmode bank value | Set value to bank fish files after filling inventory | value range is 500-10000. You need banker scroll in vip panel or inventory |
| fish filetmode | disable any interactions with fillets  |   |
| fish debug | debug mode  |   |


You can manually edit config file<br>
Repo will contains opcodes only for RU, unless someone send me them for other regions. Use [Find packet id](https://github.com/Owyn/alex-packet-id-finder) / [PacketsLogger](https://github.com/SoliaRdi/PacketsLogger)<br>
