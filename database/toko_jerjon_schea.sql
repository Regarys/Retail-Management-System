--
-- PostgreSQL database dump
--

\restrict PlBAgMpAy9lpO2bkrRaLtgUGeXV0F9Pi0jZAYZKn24fna2SMfTiyX51EcCKdLV5

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: invoice_details; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoice_details (
    id_detail integer NOT NULL,
    id_invoice integer NOT NULL,
    product_name character varying(100) NOT NULL,
    qty integer NOT NULL,
    price numeric(13,2) NOT NULL,
    total numeric(13,2) NOT NULL
);


ALTER TABLE public.invoice_details OWNER TO postgres;

--
-- Name: invoice_details_id_detail_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.invoice_details_id_detail_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invoice_details_id_detail_seq OWNER TO postgres;

--
-- Name: invoice_details_id_detail_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.invoice_details_id_detail_seq OWNED BY public.invoice_details.id_detail;


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoices (
    id_invoice integer NOT NULL,
    customer_name character varying(100),
    total_price numeric(13,2) NOT NULL,
    paid numeric(13,2) NOT NULL,
    return_price numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.invoices OWNER TO postgres;

--
-- Name: invoices_id_invoice_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.invoices_id_invoice_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invoices_id_invoice_seq OWNER TO postgres;

--
-- Name: invoices_id_invoice_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.invoices_id_invoice_seq OWNED BY public.invoices.id_invoice;


--
-- Name: product; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product (
    id_product integer NOT NULL,
    name_product character varying(100) NOT NULL,
    price_total numeric(12,2) NOT NULL,
    price numeric(10,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.product OWNER TO postgres;

--
-- Name: product_id_product_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.product_id_product_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.product_id_product_seq OWNER TO postgres;

--
-- Name: product_id_product_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.product_id_product_seq OWNED BY public.product.id_product;


--
-- Name: invoice_details id_detail; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_details ALTER COLUMN id_detail SET DEFAULT nextval('public.invoice_details_id_detail_seq'::regclass);


--
-- Name: invoices id_invoice; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices ALTER COLUMN id_invoice SET DEFAULT nextval('public.invoices_id_invoice_seq'::regclass);


--
-- Name: product id_product; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product ALTER COLUMN id_product SET DEFAULT nextval('public.product_id_product_seq'::regclass);


--
-- Name: invoice_details invoice_details_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_details
    ADD CONSTRAINT invoice_details_pkey PRIMARY KEY (id_detail);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id_invoice);


--
-- Name: product product_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_pkey PRIMARY KEY (id_product);


--
-- Name: invoice_details invoice_details_id_invoice_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_details
    ADD CONSTRAINT invoice_details_id_invoice_fkey FOREIGN KEY (id_invoice) REFERENCES public.invoices(id_invoice);


--
-- PostgreSQL database dump complete
--

\unrestrict PlBAgMpAy9lpO2bkrRaLtgUGeXV0F9Pi0jZAYZKn24fna2SMfTiyX51EcCKdLV5

