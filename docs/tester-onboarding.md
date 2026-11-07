# Till dig som testar Kilowattlas på Homey

Tack för att du vill hjälpa till. Det här dokumentet säger vad vi gör, vad som
lämnar din Homey, och vad vi behöver av dig. Fråga om något är oklart.

## Vad det handlar om

[Kilowattlas](https://kilowattlas.com) är en öppen karta över svensk
hemenergi. För Home Assistant finns en färdig integration som delar
Energy-panelens effektmätvärden. Nu bygger vi samma sak för Homey, och du har
den hårdvara vi behöver testa mot: P1-mätare, solceller, batteri/laddbox och
en Shelly Pro 3EM.

Kilowattlas mäter, räknar och organiserar. Det styr aldrig din utrustning. Det
här är ett test; inget du gör här binder dig till något, och du kan när som
helst ta bort allt (se längst ner).

## Vad som delas

- Varje effektmätvärde (kW) med tidsstämpel från de kanaler du valt: sol,
  nät, hemmets förbrukning, batteri (effekt och laddnivå), laddbox.
- Din anläggnings position en gång (du bekräftar den på webben) och
  solcellernas toppeffekt.
- Inget annat: inga enhetsnamn utöver de du själv döper kanaler till, inga
  Flows, inga andra enheter.

Visas publikt, på cirka 100 m noggrannhet, utan namn eller konto: produktion
och batteri. Bara för dig: nät, hemmets förbrukning och enskilda laster. Varje
kanal kan sättas till publik, bara jag eller av på kilowattlas.com.
Tjänsten är gratis och säljer inte data.

## Steg 0: några frågor (svara som text eller skärmdumpar)

1. Homey-modell och firmware-version (Inställningar → Allmänt → Om).
2. **Shelly Pro 3EM:** var sitter den? På inkommande (bredvid P1) eller på
   en undergrupp (laddbox, värmepump, växelriktare)?
3. Ungefärlig solcellseffekt (kW) och batterikapacitet (kWh).

## Steg 1: koppla in Homey (cirka tio minuter)

Det finns ingen app ännu, så vi använder Athoms egen app **HomeyScript**.
Följ [installationsguiden](installera.md), steg för steg med bilder. Du
behöver inte fylla i något i scriptet.

Klart. Efter några minuter syns anläggningen under *Mina anläggningar* på
kilowattlas.com. Där väljer du för varje kanal om den ska vara publik, bara
synlig för dig, eller avstängd. Scriptet följer det du väljer.

Shelly 3EM och andra mätare som Homey Energy inte har klassat skickas inte
automatiskt. Scriptet listar dem med ett id. Vill du skicka en, säg till så
hjälper vi dig att lägga till den.

## Steg 2: jämför i en vecka

Låt det gå i minst sju dagar. Vid tre tillfällen per dygn de första tre
dagarna: skicka en skärmdump av Energi-fliken i Homey, och gärna av Shellys
egen app samtidigt. Vi jämför med det vi tog emot.

Ser något konstigt ut, kör gärna även
[probe.js](https://raw.githubusercontent.com/SmilingSweetSwede/kilowattlas-homey/main/homeyscript/probe.js)
som ett eget script. Det läser bara och skickar ingenting. Skicka oss
utskriften; ta bort rader du inte vill dela.

## Senare: den riktiga appen

När appen finns får du den antingen som en test-länk i Homey App Store eller
installerad av oss på distans, efter att du bjudit in vårt konto till ditt
hushåll. Då tas Flow:et och scriptet bort. Vi kör en checklista tillsammans
(installation, kanalval, omstart, en timme utan internet, borttagning) och
sedan fjorton dagars vanlig drift.

## Att sluta

Ta bort Flowet och scriptet (senare: appen). Logga in på kilowattlas.com och
radera installationen under *Mina anläggningar*; då raderas dess historik.
Vill du bara koppla bort Homey: ändra `UNLINK = false` till `UNLINK = true`
överst i scriptet och kör det en gång.
Skriv gärna en rad till oss, så vi vet.
