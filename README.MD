## Tera proxy module for auto fishing.

---

## First Time Installation & Updating Opcodes
- Move the files inside the defs folder into Your-Proxy-Folder/node_modules/tera-data/protocol.
- Move and merge the protocol files into Your-Proxy-Folder/node_modules/tera-data/map.
- An mapping overview for your region can be found here [Mapping Overview](https://github.com/caali-hackerman/tera-data/blob/master/mappings.json).

---

## Commands
You can edit the delays in the YourName-ServerID.json file via notepad once you enter `/8 fish save`.

| Command  | Description | Additional Information
| ------------- | ------------- | ------------- |
| /8 fish | To enable the module. |  |
| /8 gmmode | Action that we take when GM spawn detected | exit,lobby, stop or nothing |
| /8 fish blacklist add `link` | Add the desired item to the blacklist for auto decompose or selling | Blacklist means, that you don't want this fishes to be dismantled or sold. |
| /8 fish blacklist remove `link` | Remove the desired item from the blacklist. | How to link is described in the note section. |
| /8 fish blacklist reset | Reset your current blacklist. | In case you want to remove everything. |
| /8 fish setrecipe | The last used recipe will be used for auto crafting. |  |
| /8 fish selltonpc `range` | Sell fishes when your inventory is full to fishing merchant. | Maximum range between you and the npc is 6 meters. |
| /8 fish filetmode bank `value` | Set the value to bank fish filets after filling your inventory. | Value range is 500 - 10000. You need at least one banker scroll in vip panel or inventory. |
| /8 fish filetmode | Disable any interactions with filets. | Useful for switching different modes. |
| /8 fish sellscroll | Sell fishes when your inventory is full. | You need traveling merchant scroll in your inventory and additional opcodes & defs. |
| /8 fish autosalad | To enable auto using of fish salad. | Both craftable and event salad gets auto detected. |
| /8 fish reloadconf | To reload your current configuration file. | In case you are editing something manually and you are still ingame. |
| /8 fish save | To save your entered settings.  | Config file gets generates per character. |
| /8 fish stats| Print current fishing statistic. | Fish level, total fishes and time per fish. |
| /8 fish debug | Debug mode of the modules current function. | Shows you decision that bot takes. |

---

## Note
- To add an item link into the chat just press ctrl and left mouse onto the desired item.
- This repo will only contain the opcodes for the Ru and Eu version, unless someone send them to me for other regions.

---

- If you need to log them yourself use this module for logging specific packets [Packet ID Finder](https://github.com/Owyn/alex-packet-id-finder).
- If you need to log them yourself use this module for logging all client or server packets [Packets Logger](https://github.com/SoliaRdi/PacketsLogger).

---

## Changes With The Latest Big Update
- From now on this module will only work on Caali's Tera Proxy.
- The bot is crafting baits once (10 baits) instead of the max. amount.
- There is no need to use the setbait command since they get autodetected now.
- If you want to farm filet you need to use `/8 fish filetmode bank` since there is no drop option anymore.
