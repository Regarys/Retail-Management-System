<img width="1920" height="786" alt="2026-10-13-113625_hyprshot" src="https://github.com/user-attachments/assets/e07dffcd-5421-4fb7-82dd-aa844ce06698" /># Retail-Management-System

## Overview
I made this because my mom has a problem of making an invoice. I have an idea to help her out by making this program, at first I am thinking why don't make the whole app, like stock, list price product, and etc.

I ended up making the list product (CRUD) product, (CRUD) invoices, and printing the invoice. But i am facing new problem that i cannot afford for now. Servers. So i think i will make new version of this that is only printing invoice so i can just post it in GitHub pages.

So about that, let's talk about the app/program.

## The App
1. Login Page
- I made a login app for this app that is only having 1 user, it's saved on .env
<img width="1920" height="459" alt="2026-10-13-113348_hyprshot" src="https://github.com/user-attachments/assets/1d50db54-7120-473e-910d-a6abdb649a62" />
  
2. The Product CRUD
- Here is the page where adding product happened
<img width="1920" height="952" alt="2026-10-12-204423_hyprshot" src="https://github.com/user-attachments/assets/625b3fb0-9e17-4baf-bf61-8201cfebb44e" />

3. Invoice
- Here is the page where adding invoices took place
<img width="1920" height="954" alt="2026-10-12-204432_hyprshot" src="https://github.com/user-attachments/assets/f7b5c39b-daa9-4fbd-a86d-4c83ea27798d" />

4. Invoice Detail
- The page where adding details such as adding product customer buy and adding paying detail if their money it's more than their shopping list its payment complete, if doesn't it's become a debt.
<img width="1920" height="952" alt="2026-10-12-204528_hyprshot" src="https://github.com/user-attachments/assets/1eb60f64-3224-4bd8-bf16-b18b4a46e4bd" />

5. Invoice Printing Page
- The page when you print the invoice, the plan is printing on thermal printer, but the thermal printer is on their way home right now, so i don't have the physical documentation
- <img width="1920" height="786" alt="2026-10-13-113625_hyprshot" src="https://github.com/user-attachments/assets/17237d6e-a943-425d-b683-cf56dec1b90a" />

## Tech I Use
1. JavaScript
2. HTML, CSS, and JS
3. NodeJS & expressjs
4. PostgreSQL
5. Bcript (for password hash only)

## Installation & Usage
1. Clone this Repo
2. npm i
3. Import the stuctures in /Database
4. About the .env here is the structure you might need to match
    PORT = 3030
    DB_USER = postgres
    DB_HOST = localhost
    DB_PORT = 5432
    DB_DATABASE = 'Your Database'
    USERNAME = 'Username you want'
    PASSWORD = 'bcript your password'
    TOKEN = 'I don't know why i made token for 1 user'
6. node server.js
7. Then it should be ready in http://localhost:3030/

## Future Update (Plan)
Making the stock but i need server
Making its accessible from anywhere which is again i need server
When installing it has option of the name of their retail title, for now its manual to change.
