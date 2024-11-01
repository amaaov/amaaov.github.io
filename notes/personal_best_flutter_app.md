# Personal best flutter app plan

The application for tracking any personal records which can be identified by unique name, e.g.:
- run 100m
- juggle 3 balls cascade
- solve 8x8x8 rubik's cube
- type 100 words

Name should start with a verb and include all constraints which are static and measurable. There is no difference between 1km and 1000m for example. There is a difference between "juggle 3 balls cascade" and "juggle 3 balls cascade 100 catches". The less constraints name has the more flexible judgement criteria of the record. In the same time there is a value of the name with more constraints as it is more specific and descriptive and harder to achieve.

Main dynamic unit is a second (time), we measure time for any type of activity as it is the most accessible and measurable dynamic metric which is unknown before the activity.
More dynamic metrics can be added as additional values, they should include a unit, follow the standard format, e.g. 100 kg, 100 cm, 100 km, 3 poi, 5 clubs, 5 people, etc. There should be clear motivation to add more values as they has to be measurable by any person by looking at the record and video.

Video should have as much entropy and synchronous events as possible, e.g. even if you use slow-motion or time-lapse there should be clock or metronome in the video which will be visible and audible, although understandable that it is possible to fake it. The less effort you spend on editing the video the better. Include as much proof as possible. Include people who will be witnesses and confirm the record and how video was made.

## Features

- [ ] Offline first, sync on demand
- [ ] English first, add i18n as a separate feature
- [ ] Add a record: name, date in format YYYY-MM-DD, time in seconds, location in format "city @ country", additional values, notes, links to videos, images, list of involved people, labels
- [ ] Autocomplete names and labels, use external services for translations and transformations, maybe use local mini LLM models in order to have names and labels in the single language and format
- [ ] Edit a record
- [ ] Delete a record
- [ ] Search for a record
- [ ] Filter records by date, time, location, people, labels
- [ ] Sort records by date, time, location, people, labels
- [ ] Export records to CSV, PDF, JSON, etc.
- [ ] Import records from CSV, PDF, JSON, etc.
- [ ] Show records on a geo map
- [ ] Show records on a timeline
- [ ] Show records graph by date, location, people, labels

- [ ] Sync all records with a community repository
- [ ] Search community records
- [ ] View community records on a geo map
- [ ] View community records on a timeline
- [ ] View community records graph by date, location, people, labels

- [ ] Login with GitHub, allow creating repositories, allow creating and editing pull requests, allow pushing to repositories
- [ ] Sync records with a personal repository
- [ ] Create records.md with personal best records
- [ ] Suggest a record to the community repository as a pull request
- [ ] View review progress and participate in discussion
- [ ] Receive notifications after sync: new comments, new pull requests, new records, etc.

## UI

- [ ] Home screen
- [ ] New record screen
- [ ] Edit record screen
- [ ] Record details screen
- [ ] Personal records list screen
- [ ] Personal records map screen
- [ ] Personal records graph screen
- [ ] Community records list screen
- [ ] Community records map screen
- [ ] Community records graph screen
- [ ] Record review screen

## Apps

- [ ] Android app
- [ ] iOS app
- [ ] Web app

## Data storage

- [ ] Local SQLite databases
- [ ] Browser IndexedDB
- [ ] GitHub repositories using GitHub API

## Files format

- [ ] Store data in human readable markdown files
- [ ] Do not store any binary data, do not store any media files
- [ ] Store all files in UTF-8 encoding
- [ ] Use common markdown format for all files

## Conflict resolution

- [ ] Automatically resolve conflicts by rewriting the file to the latest version from the device
- [ ] Personal and community storages should be separated
- [ ] Personal storage should be available and accessible by community participants
