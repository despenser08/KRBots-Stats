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
import { AkairoClient } from "discord-akairo";
import moment from "moment-timezone";
import schedule from "node-schedule";
import { TIMEZONE } from "../config";
import { KoreanlistEndPoints } from "./constants";
import BotDB from "./database/models/Bot";
import ServerDB from "./database/models/Server";
import { FetchResponse, RawBot, RawServer } from "./types";
import convert from "./utils/convertRawToType";

export default function (client: AkairoClient) {
  return schedule.scheduleJob("* * * * *", (date) => {
    BotDB.find({ track: true }).then((bots) => {
      for (const bot of bots)
        axios
          .get<FetchResponse<RawBot>>(KoreanlistEndPoints.API.bot(bot.id))
          .then(async ({ data }) => {
            const res = convert.bot(data.data);

            await bot.updateOne({
              $push: {
                stats: {
                  updated: moment(date).tz(TIMEZONE).toDate(),
                  votes: res.votes,
                  servers: res.servers,
                  status: res.status.raw
                }
              }
            });
          })
          .catch((e) => {
            client.logger.warn(
              `FetchError: Error occurred while fetching bot ${bot.id}:\n${e.message}\n${e.stack}`
            );
          });
    });

    ServerDB.find({ track: true }).then((servers) => {
      for (const server of servers)
        axios
          .get<FetchResponse<RawServer>>(
            KoreanlistEndPoints.API.server(server.id)
          )
          .then(async ({ data }) => {
            const res = convert.server(data.data);

            await server.updateOne({
              $push: {
                stats: {
                  updated: moment(date).tz(TIMEZONE).toDate(),
                  votes: res.votes,
                  members: res.members
                }
              }
            });
          })
          .catch((e) => {
            client.logger.warn(
              `FetchError: Error occurred while fetching server ${server.id}:\n${e.message}\n${e.stack}`
            );
          });
    });

    const guildCount = client.guilds.cache.size;
    if (guildCount !== client.cachedGuildCount)
      axios
        .post(
          KoreanlistEndPoints.API.stats(client.user.id),
          { servers: guildCount },
          {
            headers: {
              Authorization: process.env.KOREANBOTS_TOKEN,
              "Content-Type": "application/json"
            }
          }
        )
        .then(({ data }) => {
          client.logger.info(
            `Bumped ${guildCount} guilds to koreanbots.dev | Response:\n${JSON.stringify(
              data
            )}`
          );
          client.cachedGuildCount = guildCount;
        })
        .catch((e) => {
          client.logger.warn(
            `FetchError: Error occurred while updaing bot server count:\n${e.message}\n${e.stack}`
          );
        });
  });
}
