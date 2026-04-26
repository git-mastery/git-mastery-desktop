# Git-Mastery Desktop app Developer Guide

## Installing
1. Clone the repository: 
```
git clone https://github.com/HollaG/electron-git-mastery.git
```

2. cd into it:
```
cd eletron-git-mastery
```

3. Install dependencies:
```
npm install
```

## Developing
Start the application: 
```
npm run dev
```

Notes:
* `npm run dev` starts both Electron backend & React frontend

## Building
Note: The build process takes quite a while. Be patient and let it finish
### Windows
```
npm run dist:win
```
Run the .exe to open the app.

Note: you may run into an error requiring you to install Build Tools for Windows. Please follow the instructions stated in the error.

### MacOS
```
npm run dist:mac
```

Outputs:
1. `.dmg` in `dist/git-mastery-{version}-arm64.dmg
2. `.app` (portable) in `dist/mac-arm64/git-mastery.app`

Special note for MacOS: Due to Apple restricting unsigned builds, users must run the following command before opening the app:

```
xattr -rc /Applications/git-mastery.app
```

Failure to run this command will result in an error saying that the app is damaged.



### Linux
```
npm run dist:linux
```
