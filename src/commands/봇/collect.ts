/**
 * Copyright (C) 2021 despenser08
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import axios from "axios";
import { Argument, Command } from "discord-akairo";
import { GuildMember, Message, User, Util } from "discord.js";
import { KoreanbotsEndPoints } from "../../lib/constants";
import Bot from "../../lib/database/models/Bot";
import convert from "../../lib/utils/convertRawToType";

export default class extends Command {
  constructor() {
    super("수집", {
      aliases: ["수집", "collect", "track", "추적"],
      description: {
        content: "해당 봇의 정보를 수집합니다.",
        usage: "<봇>"
      },
      args: [
        {
          id: "userOrId",
          type: Argument.union("user", "member", "string"),
          prompt: { start: "봇을 입력해 주세요." }
        }
      ]
    });
  }

  public async exec(
    message: Message,
    { userOrId }: { userOrId: string | User | GuildMember }
  ) {
    const msg = await message.channel.send("잠시만 기다려주세요...");

    const id =
      userOrId instanceof User || userOrId instanceof GuildMember
        ? userOrId.id
        : userOrId;

    await axios
      .get(KoreanbotsEndPoints.API.bot(id))
      .then(async ({ data }) => {
        const bot = convert.bot(data.data);

        const botDB = await Bot.findOneAndUpdate(
          { id: bot.id },
          {},
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        if (botDB.track)
          return msg.edit(
            `**${Util.escapeBold(
              bot.name
            )}** 수집은 이미 시작되었습니다. 새로 등록하셨다면 1분을 기다려주세요.`
          );

        await botDB.updateOne({ track: true });

        return msg.edit(
          `1분마다 **${Util.escapeBold(bot.name)}** 수집이 시작됩니다.`
        );
      })
      .catch((e) => {
        this.client.logger.warn(
          `FetchError: Error occurred while fetching bot ${id}:\n${e}`
        );
        return msg.edit(`해당 봇을 가져오는 중에 에러가 발생하였습니다.\n${e}`);
      });
  }
}
