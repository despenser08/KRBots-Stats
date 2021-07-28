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
import schedule from "node-schedule";
import { KoreanbotsEndPoints } from "../constants";
import BotDB from "../database/models/Bot";
import type KRBSClient from "../KRBSClient";
import convert from "./convertRawToType";

let cachedGuildCount = 0;

export default async function (client: KRBSClient) {
  schedule.scheduleJob("*/1 * * * *", async (date) => {
    const bots = await BotDB.find({ track: true });

    for (const bot of bots)
      await axios
        .get(KoreanbotsEndPoints.API.bot(bot.id))
        .then(async ({ data }) => {
          const res = convert.bot(data.data);

          await BotDB.findOneAndUpdate(
            { id: res.id },
            {
              $push: {
                stats: {
                  updated: date,
                  votes: res.votes,
                  servers: res.servers,
                  status: res.status ? res.status.raw : undefined
                }
              }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        })
        .catch((e) => {
          client.logger.warn(`FetchError: Error occurred while fetching bot ${bot.id}:\n${e}`);
        });

    const guildCount = client.guilds.cache.size;
    if (guildCount !== cachedGuildCount)
      await axios
        .post(
          KoreanbotsEndPoints.API.stats(client.user?.id as string),
          { servers: guildCount },
          {
            headers: {
              Authorization: process.env.KOREANBOTS_TOKEN,
              "Content-Type": "application/json"
            }
          }
        )
        .then(({ data }) => {
          client.logger.info(`Bumped ${guildCount} guilds to koreanbots.dev | Response:\n${JSON.stringify(data)}`);
          cachedGuildCount = guildCount;
        })
        .catch((e) => {
          client.logger.warn(`FetchError: Error occurred while updaing bot server count:\n${e}`);
        });
  });
}
