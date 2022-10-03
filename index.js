import axios from "axios";
import express from "express";
import * as cheerio from "cheerio";
import fs from fs;

const app = express();
const PORT = 4000;

const URL = `https://www.otomoto.pl/ciezarowe/uzytkowe/mercedes-benz/ od-2014/q-actros? 
search%5Bfilter_enum_damaged%5D=0&search%5Border%5D=created_at %3Adesc`;

/**
 * Each item has two property.
 * items = [
 *      {
 *          itemUrl:"",
 *          itemId: ""
 *      }
 * ]
 */
var items = [];

/**
 * Each truch item contains:
 * truckItems = [
 *      {
 *          itemsId: "",
 *          title: "",
 *          price: "",
 *          mileage: "",
 *          registrationDate: "",
 *          productionDate: "",
 *          power: ""
 *      }
 * ]
 */
var truckItems = [];

var totalPages = 0;
var currentPageNo = 1;

function getNextPageUrl() {
    if (currentPageNo === 1) {
        currentPageNo++;
        return URL;
    } else if (currentPageNo < totalPages + 1) {
        const nextPageUrl = URL + `&page=${currentPageNo++}`;
        return nextPageUrl;
    } else return null;
}

async function setTotalPages() {
    try {
        const htmlResponse = await axios.get(URL);
        const $ = cheerio.load(htmlResponse.data, {
            xml: {
                normalizeWhitespace: true,
            },
        });
        // Get total pagination Pages number from selected categories
        $("li[data-testid='pagination-list-item']")
            .last()
            .each((index, element) => {
                totalPages = parseInt($(element).text());
            });
    } catch (e) {
        console.log(e);
        console.log("Error occured on getTotalPage().");
    }
}

async function addItems() {
    try {
        console.log("Items adding has started! \n");
        for (let i = 1; i < totalPages + 1; i++) {
            const htmlResponse = await axios.get(getNextPageUrl());
            const $ = cheerio.load(htmlResponse.data, {
                xml: {
                    normalizeWhitespace: true,
                },
            });

            // Get Items from each pages
            $(`main[data-testid='search-results']`)
                .find("article")
                .each(function (index, element) {
                    const itemId = $(element).attr("id").toString();
                    const itemUrl = $(element)
                        .find(`h2[data-testid="ad-title"] > a`)
                        .attr("href")
                        .toString();
                    const item = { itemUrl: itemUrl, itemId: itemId };
                    items.push(item);
                    console.log(item);
                });

            console.log("Counter = " + i);
        }
    } catch (e) {
        console.log("Error Occured!");
        console.log(e);
    }
}

function getTotalAdsCount(isShow = false) {
    const counted = items.length;
    if (isShow) console.log("Total ads counted: " + counted);
    return counted;
}

async function scrapeTruckItem() {
    console.log("Start scraping truck item. \n");
    const itemsLength = items.length;
    for (let i = 0; i < itemsLength; i++) {
        console.log(`countering Item No.: ${i} / ${itemsLength} \n`);
        try {
            const htmlResponse = await axios.get(items[i].itemUrl);
            const $ = cheerio.load(htmlResponse.data, {
                xml: {
                    normalizeWhitespace: true,
                },
            });

            let title = "",
                currency = "",
                price = "",
                power = "",
                productionDate = "",
                registrationDate = "",
                mileage = "";

            $("div.offer-summary").each((index, element) => {
                title = $(element).find("span.offer-title").text().trim().toString();

                currency = $(element)
                    .find("span.offer-price__number .offer-price__currency")
                    .text()
                    .trim()
                    .toString();

                price = $(element)
                    .find("div.offer-price")
                    .attr("data-price")
                    .toString()
                    .trim()
                    .replace(" ", ",");
            });

            $("li span.offer-params__label").each((index, el) => {
                if ($(el).first().get(0).children[0]["data"].trim().toString() === "Moc") {
                    power = $(el).parent().find("div").get(0).children[0]["data"].toString().trim();
                }

                if (
                    $(el).first().get(0).children[0]["data"].toString().trim() === "Rok produkcji"
                ) {
                    productionDate = $(el)
                        .parent()
                        .find("div")
                        .get(0)
                        .children[0]["data"].toString()
                        .trim();
                }

                if (
                    $(el).first().get(0).children[0]["data"].toString().trim() ===
                    "Pierwsza rejestracja"
                ) {
                    registrationDate = $(el)
                        .parent()
                        .find("div")
                        .get(0)
                        .children[0]["data"].toString()
                        .trim();
                }

                if ($(el).first().get(0).children[0]["data"].toString().trim() === "Przebieg") {
                    mileage = $(el)
                        .parent()
                        .find("div")
                        .get(0)
                        .children[0]["data"].toString()
                        .trim();
                }
            });

            const truckItem = {
                itemsId: items[i].itemId,
                title: title,
                price: price,
                mileage: mileage,
                registrationDate: registrationDate,
                productionDate: productionDate,
                power: power,
            };

            truckItems.push(truckItem);
            console.log(truckItem);
        } catch (e) {
            console.log(e);
            console.log("Error occured on scrapetruchItem().");
        }
    }
}

async function saveAsJson() {
    let datas = JSON.stringify(truckItems);
    fs.writeFileSync('truckdetails.json', datas);
    console.log("Saved as truckItems.json");
}

await setTotalPages();
await addItems();
await getTotalAdsCount(true);
await scrapeTruckItem();
await saveAsJson();

app.listen(PORT, () => console.log(`Server is running on port: ${PORT}`));
