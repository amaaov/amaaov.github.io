# Spontaanius ja afesis

**Julkaistu:** 7. marraskuuta 2026  
**Tekijä:** amaaov  
**Kieli:** Suomi · [Русский](20261107131500_sua_sponte_non_programming.md) · [English](20261107131500_sua_sponte_non_programming_en.md)  
**HTML:** [Suomi](20261107131500_sua_sponte_non_programming_fi.html) · [Русский](20261107131500_sua_sponte_non_programming.html) · [English](20261107131500_sua_sponte_non_programming_en.html)  
**Lisenssi:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — mainitse Andrei Makarov / amaaov

---

Halpojen digitaalisyntetisaattorien vibe-koodattuja laiteohjelmistoja käsittelevän videon kommenttikeskustelu pysähtyi sekvensseriin. Laitteilla oli joko avoin SDK tai niiden laiteohjelmisto oli jo takaisinmallinnettu. Keskustelukumppanini hyväksyi ohjelmoinnin niin kauan kuin se pysyi luettavana ja muokattavana koodina. Painikkeiden painaminen jäi rajan ulkopuolelle.

Sekvensseri tekee rajasta erityisen näkyvän. Muusikko syöttää tapahtuman, sävelkorkeuden, ajankohdan tai keston, laite tallentaa kuvion ja toistaa sen ajassa. Ohjelmatekstiä ei tarvitse syntyä missään vaiheessa. Syötetty jakso määrää silti koneen myöhempää toimintaa niin suoraan, että sekvensserien, kuvioiden ja äänten ohjelmointi on pitkään kuulunut käyttöohjeiden ja muusikoiden sanastoon. Kun tämä hyväksytään ohjelmoinniksi, syöttötapa ei enää kelpaa yleiseksi rajaksi.

Käytän tässä artikkelissa laajaa merkitystä: **ohjelmointi on tietokonejärjestelmän tilapolun muokkaamista syötteellä, jonka järjestelmä todella vastaanottaa ja käsittelee**. Lähteenä voi olla ihminen, toinen kone, ohjelma, anturi tai ympäristö sen jälkeen, kun vaikutus on muuttunut tietokoneen käytettävissä olevaksi signaaliksi. Lähteen tarkoitus, tekstimuotoinen koodi ja seurausten täydellinen ymmärtäminen eivät kuulu määritelmän ehtoihin.

Merkitys on tarkoituksella tavallista ammattikieltä laajempi. En väitä, että jokaista tekstinkäsittelyohjelmaan kirjoitettua kirjainta jo kutsuttaisiin ohjelmoinniksi. Kirjain ja lähdekooditiedosto osallistuvat silti samaan syysuhteeseen: tietokone vastaanottaa syötteen, tulkitsee sen sääntöjensä mukaan ja siirtyy uuteen tilaan. Niiden erot ovat olennaisia, mutta ne eivät synny teon arvosta tai käyttöliittymän muodosta.

Kun käynnistän videon, ohjelmoin järjestelmän toistamaan valitsemani videon. Kun kirjoitan kommentin, määrään tietyt kirjaimet, tekstin julkaisemisen ja mahdolliset ilmoitukset vastauksista. Kun kirjoitan C++-koodia, editori käsittelee syötteeni ensin asiakirjan tilana; kääntäjä voi myöhemmin käsitellä asiakirjaa toisen järjestelmän kuvauksena. Jos koodia ei koskaan käännetä, suoritettava ohjelma ei muutu. Editori ja tiedosto muuttuvat. Jokaisessa esimerkissä pitää siis nimetä sekä syöte että se tietokonejärjestelmä, jonka toiminta muuttuu.

Yksi painallus ja ohjelma eroavat vaikutusalaltaan. Painallus voi muuttaa yhtä nykytilaa; tallennettu kuvio, komentosarja, asetus tai malli voi ohjata kokonaisen tulevien siirtymien joukon. Ne eroavat pysyvyydeltään, ilmaisuvoimaltaan, peruttavuudeltaan, hallinnan määrältään ja siltä osin, mitä seurauksia ihminen pystyy tarkastelemaan. Nämä erot eivät palauta lähdekoodille ohjelmoinnin yksinoikeutta. Ne auttavat puhumaan täsmällisemmin, kun yksinoikeudesta on luovuttu.

Pelkkä tietokoneen tarkkailu ei ole ohjelmointia. Jos katson muuttumatonta näyttöä eikä järjestelmä mittaa katsettani, minusta ei tule syötettä. Suhde muuttuu, kun läsnäolo muunnetaan tapahtumaksi: käynnistys, tauko, vieritys, katseluaika tai anturin lukema saa koneellisen esityksen ja päätyy käsittelyyn. Minun ei tarvitse tarkoittaa sitä ohjeeksi. Järjestelmä voi tuottaa mittauksen vuorovaikutuksestani. Tietokoneelle annettu komento sisältyy näin laajempaan merkitykseen, jossa jostakin tulee käsitellyn syötteen lähde.

## Lähdekoodin jälkeen

Vibe coding toi tämän eron jälleen näkyviin, vaikka ei sitä luonut. Nimi levisi laajalle [Andrej Karpathyn 2. helmikuuta 2025 julkaiseman viestin](https://x.com/karpathy/status/1886192184808149383) jälkeen. Julkinen funktiokutsujen API oli silloin ollut käytössä [kesäkuusta 2023](https://openai.com/index/function-calling-and-other-api-updates/), o1-preview-palvelu oli julkaistu [syyskuussa 2024](https://openai.com/index/introducing-openai-o1-preview/) vielä ilman funktiokutsuja ensimmäisessä rajapinnassaan ja MCP oli julkaistu [marraskuussa 2024](https://www.anthropic.com/news/model-context-protocol). Syksyllä 2025 päättelevät mallit, työkalut ja ohjelmistovarastossa työskentely yhdistyivät minulle helposti käytettäväksi käytännöksi. Syksy on oman havahtumiseni ajankohta. Sen jälkeen oli vaikea ylläpitää vaikutelmaa, että tietokone hyväksyisi vain ihmisen ennalta lähdekoodiksi pukemia ohjeita.

Tietokoneet valmistivat syötteitä myöhempää laskentaa varten jo kauan ennen kielimalleja. Grace Hopper kuvasi vuonna 1952 konetta, joka kokoaa ohjelman aliohjelmakirjastosta ja tehtävän kuvauksesta. FORTRANin tekijät kirjoittivat vuonna 1957 järjestelmästä, jonka avulla IBM 704 saattoi koodata tehtäviä matemaattisista kuvauksista. Nykyinen todennäköisyyksiin perustuva generointi toimii toisin, mutta kone on voinut valmistaa ohjelman toiselle koneelle jo pitkään.

Tämä antaa myös rajatun käyttötavan *Matrix*-esimerkille. Jos kahdella mahdollisella lähteellä on samat ehdot ja ne tuottavat saman havaittavan artefaktin ilman metatietoja tai erillistä alkuperätietoa, tietokone ei löydä artefaktista salaista ”ihmisen tekemä” -merkkiä. Kun tyyli, ajoitus, vesileima, virheiden jakauma tai tekniset metatiedot poikkeavat, lähdettä voidaan arvioida todennäköisyyksien avulla. Esimerkki koskee vain järjestelmän käytettävissä olevaa tietoa; erillinen alkuperätieto voi löytyä muualta.

Mitä useampia järjestelmiä liitetään yhteen, sitä vaikeampi yhden teon koko polkua on nähdä. Kommentti voi jäädä tallenteeksi, muuttaa nykyisen istunnon asiayhteyttä, päätyä hakuun tai moderointiin, käynnistää ilmoituksen, toimia järjestyksen muodostamisen piirteenä tai tulla myöhemmin aineistoon, josta koulutusdataa valitaan. Tuote, asetukset, alue, säilytysajat ja myöhempi valinta määräävät, mitä haaroja pitkin tapahtuma kulkee. Lokitus, tuotteen muisti, tiedonhaku, mallin inferenssi, personointi, hienosäätö ja painojen päivitys ovat eri prosesseja. Pyyntö keskustelujärjestelmälle vaikuttaa tavallisesti senhetkiseen tulokseen; siitä ei vielä seuraa, että pyyntö muutti heti neuroverkkoa.

Tapahtumien yhteydet ovat olemassa datana, mutta käyttäjä ei pysty tarkastelemaan jokaista lenkkiä. Lakisääteinen oikeus saada pääsy tietoihin tuo nähtäville henkilöön liittyvät tiedot, käsittelyn tarkoitukset ja osan käsittelyn ehdoista. GDPR:n tarkoittamissa automatisoiduissa päätöksissä oikeus kattaa merkitykselliset tiedot käsittelyyn liittyvästä logiikasta sekä käsittelyn merkittävyyden ja ennakoidut seuraukset. Tämäkään tieto ei vastaa palvelun sisäistä arkkitehtuuria, kaikkia välivaiheen piirteitä tai yksittäisen tapahtuman täydellistä polkua. Järjestelmän ylläpitäjän jäljitettävyys ja painiketta painaneen ihmisen havaintomahdollisuus ovat eri asioita.

Ero muuttuu poliittiseksi mainosverkossa. Kohdennettu vaikuttaminen ei aina tarvitse tavallista nimeä. Pysyvä pseudonyymi, laiteprofiili tai muu erotettava osoite voi auttaa verkkoa löytämään saman solmun uudelleen ja suuntaamaan sille valittua aineistoa. Eurooppalaisessa oikeudessa pseudonymisointi ei yksin poista tietoa henkilötietojen piiristä, kun henkilö voidaan edelleen erottaa kohtuudella käytettävissä olevin keinoin. Väite ”henkilötietoja ei ole, mutta juuri tähän ihmiseen voidaan kohdistaa viesti” on ristiriitainen, jos osoitettavuus yhdistää jäljet henkilöön. Julkinen nimi voi puuttua, vaikka osoitettavuuden synnyttämä haavoittuvuus säilyy.

## Silmukka molempiin suuntiin

Käytän sanaa *inferenssi* tässä laajemmin kuin koneoppimisessa tavallisesti. Tässä artikkelissa se tarkoittaa datan käsittelyä syötteen ja tuloksen välissä. Tietokoneen inferenssi voi olla laskentaa, tiedonhakua, järjestämistä tai mallin suorittamista. Inhimilliseksi inferenssiksi kutsun kulkua, jossa ihminen kuulee, näkee tai kokee jotakin ja sitä seuraavat ymmärrys, toiminta sekä sivuvaikutukset. Määrittelen tämän laajennetun käytön artikkelin sisällä; tekniset sanastot säilyttävät suppeammat merkityksensä.

Kirja ja tavallinen radio voivat vaikuttaa ihmiseen syvästi, mutta ne eivät vastaanota lukijalta tai kuulijalta paluusyötettä eivätkä sovita tarjontaansa hänelle samassa hetkessä. Vuorovaikutteinen järjestelmä vastaanottaa teon, käsittelee sen, vastaa, mittaa seuraavan teon ja muuttaa jälleen vastaustaan. Ihminen ohjelmoi tietokonetta, minkä jälkeen tietokoneen tulos muuttaa ihmisen toimintakenttää. Näin syntyy silmukka.

Silmukan jälkimmäinen puoli on helppo kärjistää muotoon ”tietokone ohjelmoi ihmistä”. Ensimmäisessä määritelmässäni ohjelmoinnin kohde oli tietokone, joten kirjaimellinen symmetria rikkoisi oman ehtonsa. Symmetriaa ei ole. Tietokone kulkee muodollisesti määriteltyjen siirtymien läpi, kun taas ihminen kohtaa valikoidun ympäristön, ehdotuksen, rajoituksen tai toiston. Silmukan jälkimmäisessä osassa *ohjelmointi* nimeää vuorovaikutteisen välineen kautta tapahtuvan vaikutuksen. Ihmisestä ei tule suoritettavaa funktiota.

Tämä ero on minulle olennainen. Matematiikka ja tiede voivat kuvata ihmisen käyttäytymistä, kehoa, puhetta ja suhteita. Rajattu malli voi olla täsmällinen ja hyödyllinen rajatussa tehtävässä. Onnistuminen ei tee mallista tyhjentävää kuvausta ihmisestä eikä velvoita ketään hyväksymään instituutioita, jotka kohtelevat sitä sellaisena. Joku voi halutessaan kuvata itseään funktiona. Toinen voi kieltäytyä tästä itsekuvauksesta.

Emergenssi ei anna yksinkertaista todistusta päinvastaisesta. Myös laskennalliset järjestelmät tuottavat laajoja kuvioita, joita on vaikea nähdä yksittäisissä säännöissä. Heikko emergenssi sallii kokonaiskuvion määräytyä mikrodynamiikasta, vaikka kuvio tulisi ymmärrettäväksi vasta simulaatiossa tai toisella kuvaustasolla. Tietokonetta ja elävää järjestelmää voidaan verrata muodollisesti. Vertailu ei tee niiden aineesta, kehollisuudesta, kokemuksesta, suhteiden historiasta tai moraalisesta asemasta samanlaisia.

Kun puhun ihmisen kokonaisuudesta, en kiellä osien, mekanismien ja yksittäisten toimintojen tutkimista. Kieltäydyn antamasta osittaiselle kuvaukselle valtaa korvata elämän, josta kuvaus on irrotettu. Ihminen on yhteydessä kehonsa, muistinsa, ympäristönsä, aiempien päätöstensä ja suhteidensa kautta. Profiili leikkaa nämä yhteydet järjestelmän tehtävän mukaisiksi. Se voi ennustaa ostoksen ja silti olla tietämättä kivusta, mielialasta, menetyksestä, sattumanvaraisesta löydöstä tai vaivasta, joista kiinnostus kasvoi.

Jotkin ominaisuudet tulevat näkyviin vain kuljetulla polulla. Yksi tilannekuva ei kerro suuntaa, vauhtia, riippuvuutta aiemmista tiloista eikä vastausta häiriöön. Vakaa jakaumakin voi peittää jatkuvan virtauksen. Ihmisen kohdalla tämä osoittaa hyödyllisen esittämisen rajan: sama asento voi olla paluu, pysähdys tai lähdön alku. Kokonaisuus näkyy tiloja yhdistävässä siirtymässä; liikkumaton ominaisuuksien summa hukkaa kulkureitin.

Sama koskee sanoja. Kokemuksen kuvaus on uusi tapahtuma, joka valitsee ja järjestää osia koetusta. Eri ihmiset voivat nimetä läheisiä ilmiöitä eri sanoin, käyttää samaa sanaa eri ilmiöistä tai jäädä kokonaan ilman sanoja. Kieli voi myös muuttaa tarkkaavaisuutta ja myöhempää muistia. Hiljaisuus ei siksi todista tyhjyyttä, eikä eheältä näyttävä muotoilu saa valtaa ihmiseen. Kun keskustelujärjestelmä vastaa pyyntöön ”mitä minusta tiedetään” eheällä profiililla, se osoittaa oman tuloksensa eheyden. Ihminen päättää, tunnistaako hän siitä itsensä vai kiistääkö sen.

Tieto ja käytettävissä olevat sanat eivät muuta ihmisarvoa. Tämä ei tee kaikkien tekojen seurauksista samanarvoisia eikä tietämättömyydestä turvallista kaikissa tehtävissä. Vahinkoa, velvoitteita ja tehtyä työtä voidaan arvioida tekemättä sanavarastosta, tietoisuudesta tai malliin sopimisesta ihmisarvon mittaa.

## Kun internet päättyi ovelle

Minulla on elettyä elämää ajalta ennen suositusten tiheää kerrosta. Vuonna 2012 tapasimme Petroskoissa aukioilla, puistoissa ja Äänisen rantakadulla. Ihmiset toivat palloja, keiloja, poi-välineitä, sauvoja, yksipyöräisiä, slackline-liinan ja soittimia. Saatoimme sopia tekemisestä paikan päällä tai vain aloittaa vierekkäin ja lähteä myöhemmin teelle. Internet auttoi meitä kokoontumaan; sitten tietokone sammutettiin, ihmiset lähtivät ulos ja sen työ päättyi ovelle.

Vuoden 2016 tienoilla aloin huomata toisenlaisen paineen. Koordinoinnista tuli ympäristö, jossa jokaisen tapaamisen odotettiin jättävän oikein muotoiltu jatke: tallenne, valokuva, mittari tai aineisto seuraavaa näyttökertaa varten. Tietokoneet vaikuttivat jongleeraukseen ja musiikkiin suoraan sekä muiden ihmisten käyttäytymisen kautta. Näin suoratoiston tulevan osaksi musiikkia koskevia päätöksiä, samalla kun laskennalliset kamerat ja alustat muuttivat valokuvaa ja videota. Harjoituksen jäljet palasivat harjoitukseen sen näkyvyyden ehtoina.

Tällainen välitys on usein hyödyllistä ostoksissa. Järjestelmä voi poistaa pitkän, vaatimuksista lähtevän vaihtoehtojen analyysin, joka olisi melkein oma projektinsa. Henkilökohtaisessa tekemisessä hinta on suurempi, koska etsiminen, virhe ja sattumanvarainen kohtaaminen kuuluvat itse tekemiseen. Kun suositukset määräävät toistuvasti sen, mikä tulee näkyviin, kiinnostus alkaa vastata myös siihen, mitä järjestelmän on helppo jatkaa, eikä vain elettyyn kokemukseen, mielialaan, menetykseen, löytöön ja vaivannäköön.

Kieltäytyminen on tässä vaikeampaa kuin yhden välilehden sulkeminen. Myös muut ihmiset kantavat laskennallisia laitteita, ja instituutiot sekä tilat tuottavat jatkuvasti jälkiä, joten poistumisesta tulee yhteinen aineellinen kysymys. Oikeus kieltäytyä ei todista, että käyttökelpoinen poistumistie olisi jo olemassa. Se edellyttää personoimatonta reittiä, mahdollisuutta jättää tarpeettomat tapahtumat välittämättä, ymmärrettäviä keinoja katkaista yhteys ja paikkoja, joissa osallistuminen ei ole tavallisen elämän ehto.

## Seuraavan liikkeen vapauttaminen

Laajasti ymmärretyllä ohjelmoinnilla ei ole yhtä vastakohtaa. Tekninen ohjelmoimattomuus tarkoittaa, ettei syöte pysty muuttamaan järjestelmää valitun kanavan kautta. Autonomia koskee toimijan omaa toiminnan mittaa. Spontaanius koskee liikettä, joka pysyy omana, vaikka maailma antaa syitä ja aiheita. Tarvitsen myös sanan sille osapuolelle, joka voisi käyttää valtaa ja päästää siitä irti.

Kreikan *aphesis*, **afesis**, merkitsee irti päästämistä, vapauttamista, pois lähettämistä tai anteeksiantoa. Englannin fonetiikassa sanalla on jo toinen erityismerkitys, joten en esitä sitä vakiintuneena tietotekniikan terminä. Tässä afesis nimeää lähteen teon: toisen seuraavaa tilaa ei aseteta, hallinnan vaatimusta hellitetään ja jatko jätetään toiselle. Spontaanius nimeää tämän vapautuksen avaaman tilan, jossa syyt ovat yhä läsnä eikä kaaosta tarvita.

*Akrateia* ja *akrasia* eivät sovi tähän, koska ne käsittelevät itsehillinnän puutetta ja vapauttavat väärän osapuolen. *Anarkhia* tarkoittaa hallitsijan puuttumista ja kantaa omaa laajaa poliittista historiaansa. Afesis on pienempi. Se on seuraavaan liikkeeseen kohdistuvan vaatimuksen konkreettinen päättyminen.

Tästä seuraa kolme vaatimusta, joita käyttöliittymän asetuksella ei voi niellä. Ihmisellä pitää olla oikeus jäädä mukautuvan vaikuttamisen ulkopuolelle. Järjestelmän rakentajalla pitää säilyä mahdollisuus olla ohjelmoimatta muita, vaikka huomion sitominen ja personointi olisivat teknisesti mahdollisia. On säilytettävä paikkoja, joissa ohjaussilmukka todella katkeaa.

Tällainen paikka ei vaadi sotaa matematiikkaa vastaan. Työskentelen joka päivä tietokoneiden, lukujen ja digitaalisten aineistojen kanssa. Tietokone on minulle yhä väline rajattujen tehtävien ratkaisemiseen. Juuri siksi voin vetää rajan: järjestelmän kyky suorittaa tehtävä ei anna sille valtaa määritellä, kuka ihminen on; kyky ennustaa jatko ei velvoita meitä tarjoamaan sitä etukäteen.

Jossakin metsän keskellä keskustelen ystävän kanssa niin, että näemme rannan. Meillä ei ole laitteita mukana, eikä ympärillä ole havaittavaa digitaalista tarkkailua. Olemme poistuneet tutkasta. Afesis on jo tapahtunut: kukaan ei pidä seuraavaa liikettä hallussaan. Jäljelle jää spontaanius.

## Lähteet

1. Alan F. Blackwell. “What is Programming?” PPIG, 2002. [PDF](https://ppig.org/files/2002-PPIG-14th-blackwell.pdf)
2. Andrew J. Ko et al. “The State of the Art in End-User Software Engineering.” *ACM Computing Surveys* 43, no. 3, 2011. [DOI](https://doi.org/10.1145/1922649.1922658)
3. Allen Cypher, toim. *Watch What I Do: Programming by Demonstration*, 1993. [Verkkoversio](https://www.acypher.com/wwid/FrontMatter/index.html)
4. Karl J. Åström ja Richard M. Murray. *Feedback Systems*, 2008. [PDF](http://www.cds.caltech.edu/~murray/books/AM08/pdf/am08-intro_04Mar10.pdf)
5. YouTube. “YouTube’s recommendation system.” [Tuotedokumentaatio](https://support.google.com/youtube/answer/16533387?hl=en)
6. Mark Bedau. “Weak Emergence.” *Philosophical Perspectives* 11, 1997. [PDF](https://people.reed.edu/~mab/papers/weak.emergence.pdf)
7. Gary Lupyan. “Linguistically Modulated Perception and Cognition.” *Frontiers in Psychology* 3, 2012. [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC3297074/)
8. Asetus (EU) 2016/679, johdanto-osan 26 ja 30 kappale sekä 15 ja 20 artikla. [EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
9. Henry George Liddell, Robert Scott, Henry Stuart Jones. “ἄφεσις.” *A Greek–English Lexicon*. [Logeion](https://logeion.uchicago.edu/morpho/%E1%BC%84%CF%86%CE%B5%CF%83%CE%B9%CF%82)
10. Grace Hopper. “The Education of a Computer.” ACM, 1952. [DOI](https://doi.org/10.1145/609784.609818)
11. John Backus et al. “The FORTRAN Automatic Coding System.” ACM, 1957. [DOI](https://doi.org/10.1145/1455567.1455599)
12. Stanford Encyclopedia of Philosophy. “Emergent Properties.” [SEP](https://plato.stanford.edu/entries/properties-emergent/)
